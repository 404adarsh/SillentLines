<?php
require_once __DIR__ . '/api_helpers.php';

$data = input_json();
$email = clean_email($data['email'] ?? '');
$userId = require_user_id($conn, $email);
$action = preg_replace('/[^a-z_]/i', '', $data['action'] ?? 'ask') ?: 'ask';
$question = trim($data['question'] ?? '');

ensure_people_tables($conn);
ensure_universal_chat_tables($conn);

if ($action === 'new_chat') {
    json_response(['status' => 'success', 'session_id' => create_universal_session($conn, $userId)]);
}

if ($action === 'history') {
    $sessionId = (int) ($data['session_id'] ?? 0);
    if ($sessionId <= 0) {
        $sessionId = latest_universal_session($conn, $userId) ?: create_universal_session($conn, $userId);
    } else {
        assert_universal_session_owner($conn, $sessionId, $userId);
    }
    json_response(['status' => 'success', 'session_id' => $sessionId, 'messages' => universal_messages($conn, $sessionId, $userId)]);
}

if ($question === '') {
    json_response(['status' => 'error', 'message' => 'Ask something about your journals first'], 400);
}

$selectedPersonId = (int) ($data['person_id'] ?? 0);
$people = list_people($conn, $userId);
if ($selectedPersonId <= 0 && looks_person_specific($people, $question)) {
    json_response([
        'status' => 'needs_person',
        'message' => 'Please type @ and choose the exact person before asking about someone. This keeps answers specific and prevents mixing people.',
    ], 400);
}

$sessionId = (int) ($data['session_id'] ?? 0);
if ($sessionId <= 0) {
    $sessionId = create_universal_session($conn, $userId);
} else {
    assert_universal_session_owner($conn, $sessionId, $userId);
}

save_universal_message($conn, $sessionId, $userId, 'user', $question);
$historyText = universal_history_text(universal_messages($conn, $sessionId, $userId, 12));
$contextData = build_universal_context($conn, $userId, $email, $question, $selectedPersonId, $people);
$context = $contextData['context'];
if ($contextData['focus_person_name'] !== '' && preg_match('/\b(how many|count|number of|total)\b/i', $question)) {
    $count = (int) $contextData['person_entry_count'];
    $directAnswer = "You have $count saved person " . ($count === 1 ? 'entry' : 'entries') . " for {$contextData['focus_person_name']}.";
    $messageId = save_universal_message($conn, $sessionId, $userId, 'assistant', $directAnswer);
    json_response([
        'status' => 'success',
        'answer' => $directAnswer,
        'provider' => 'local journal reader',
        'session_id' => $sessionId,
        'message_id' => $messageId,
        'messages' => universal_messages($conn, $sessionId, $userId),
        'matches' => $contextData['matches'],
    ]);
}
$historyForPrompt = $contextData['focus_person_name'] === '' ? $historyText : 'Focused person question. Previous chat is intentionally not used as evidence.';
$answer = ai_answer(
    "You are a universal private journal reader. Answer only from the provided saved context. If a Focus person is provided, answer only about that person and do not mention or borrow facts from other people. Give dates and patterns when available. If data is missing, say that clearly. Be useful for decisions, but do not invent facts.",
    "All saved journal context:\n$context\n\nRecent universal chat:\n$historyForPrompt\n\nUser question: $question"
);
$messageId = save_universal_message($conn, $sessionId, $userId, 'assistant', $answer['text']);

json_response([
    'status' => 'success',
    'answer' => $answer['text'],
    'provider' => $answer['provider'],
    'session_id' => $sessionId,
    'message_id' => $messageId,
    'messages' => universal_messages($conn, $sessionId, $userId),
    'matches' => $contextData['matches'],
]);

function build_universal_context(mysqli $conn, int $userId, string $email, string $question, int $selectedPersonId = 0, ?array $people = null): array {
    $maxChars = 42000;
    $parts = [
        "Relevant compact journal context. Some long entries are shortened to stay inside the AI context window.",
    ];
    $table = diary_table($conn);
    $textColumn = column_exists($conn, $table, 'entry_text') ? 'entry_text' : 'entry';
    $dateExpr = column_exists($conn, $table, 'created_at') ? 'created_at' : 'id';

    $where = '1=1';
    $types = '';
    $values = [];
    if (column_exists($conn, $table, 'user_id')) {
        $where = 'user_id = ?';
        $types = 'i';
        $values[] = $userId;
    } elseif (column_exists($conn, $table, 'owner_email')) {
        $where = 'owner_email = ?';
        $types = 's';
        $values[] = $email;
    } elseif (column_exists($conn, $table, 'email')) {
        $where = 'email = ?';
        $types = 's';
        $values[] = $email;
    }

    $people = $people ?? list_people($conn, $userId);
    $focusPeople = [];
    if ($selectedPersonId > 0) {
        foreach ($people as $person) {
            if ((int) $person['id'] === $selectedPersonId) {
                $focusPeople = [$person];
                break;
            }
        }
        if (!$focusPeople) {
            json_response(['status' => 'error', 'message' => 'Selected person was not found'], 404);
        }
    }
    if (!$focusPeople) {
        $focusPeople = focus_people($people, $question);
    }
    $focusTerms = focus_terms($focusPeople, $question);

    if ($focusPeople) {
        $parts[] = "Focus person: " . implode(', ', array_map(function ($person) {
            return $person['name'];
        }, $focusPeople)) . ". Only this person's saved notes are included.";
    }

    if (!$focusPeople) {
        add_context_line($parts, "Personal diary entries:", $maxChars);
        $stmt = $conn->prepare("SELECT LEFT($textColumn, 1400) AS entry_text, $dateExpr AS created_at FROM $table WHERE $where ORDER BY $dateExpr DESC LIMIT 160");
        if ($types !== '') {
            bind_dynamic($stmt, $types, $values);
        }
        $stmt->execute();
        $diaryRows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        usort($diaryRows, function ($a, $b) use ($question) {
            return relevance_score((string) $b['entry_text'], $question) <=> relevance_score((string) $a['entry_text'], $question);
        });
        foreach ($diaryRows as $index => $row) {
            $entryText = (string) $row['entry_text'];
            $score = relevance_score($entryText, $question);
            if ($index >= 50 && $score === 0) {
                continue;
            }
            add_context_line($parts, "- {$row['created_at']}: " . compact_text($entryText, 900), $maxChars);
        }
    }

    add_context_line($parts, "\nPeople records:", $maxChars);
    if ($focusPeople) {
        $people = $focusPeople;
    }
    usort($people, function ($a, $b) use ($question) {
        $aText = ($a['name'] ?? '') . ' ' . ($a['details'] ?? '');
        $bText = ($b['name'] ?? '') . ' ' . ($b['details'] ?? '');
        return relevance_score($bText, $question) <=> relevance_score($aText, $question);
    });
    $matches = [];
    foreach ($people as $person) {
        add_context_line($parts, "- {$person['name']} | Details: " . compact_text((string) $person['details'], 600), $maxChars);
        if (!empty($person['linked_username']) || !empty($person['linked_user_id'])) {
            foreach (linked_user_context($conn, $table, $textColumn, $dateExpr, $userId, $person) as $line) {
                add_context_line($parts, $line, $maxChars);
            }
        }
        $entries = $person['entries'] ?? [];
        usort($entries, function ($a, $b) use ($question) {
            $aText = ($a['knowledge'] ?? '') . ' ' . ($a['behavior'] ?? '') . ' ' . ($a['notes'] ?? '');
            $bText = ($b['knowledge'] ?? '') . ' ' . ($b['behavior'] ?? '') . ' ' . ($b['notes'] ?? '');
            return relevance_score($bText, $question) <=> relevance_score($aText, $question);
        });
        foreach ($entries as $index => $entry) {
            $entryText = ($entry['knowledge'] ?? '') . ' ' . ($entry['behavior'] ?? '') . ' ' . ($entry['notes'] ?? '');
            $entryScore = relevance_score($entryText . ' ' . ($person['name'] ?? ''), $question);
            if ($focusPeople) {
                $entryScore += 10;
            }
            if (!$focusPeople && $index >= 20 && $entryScore === 0) {
                continue;
            }
            if ($entryScore > 0 || $focusPeople) {
                $matches[] = [
                    'type' => 'person_entry',
                    'person_id' => (int) $person['id'],
                    'person_name' => $person['name'],
                    'entry_id' => (int) $entry['id'],
                    'entry_date' => $entry['entry_date'],
                    'score' => $entryScore,
                    'preview' => compact_text($entryText, 220),
                ];
            }
            add_context_line(
                $parts,
                "  {$person['name']} memory on {$entry['entry_date']} | Note ID {$entry['id']} | Know: " . compact_text((string) $entry['knowledge'], 350) .
                " | Behavior: " . compact_text((string) $entry['behavior'], 350) .
                " | Notes: " . compact_text((string) $entry['notes'], 350),
                $maxChars
            );
        }
    }

    usort($matches, function ($a, $b) {
        if ($b['score'] === $a['score']) {
            return strcmp((string) $b['entry_date'], (string) $a['entry_date']);
        }
        return $b['score'] <=> $a['score'];
    });

    return [
        'context' => implode("\n", $parts),
        'matches' => array_slice($matches, 0, 8),
        'focus_person_name' => $focusPeople ? (string) ($focusPeople[0]['name'] ?? '') : '',
        'person_entry_count' => count($matches),
    ];
}

function add_context_line(array &$parts, string $line, int $maxChars): bool {
    $currentLength = strlen(implode("\n", $parts));
    if ($currentLength + strlen($line) + 1 > $maxChars) {
        if (end($parts) !== '[Context shortened because the journal history is large.]') {
            $parts[] = '[Context shortened because the journal history is large.]';
        }
        return false;
    }
    $parts[] = $line;
    return true;
}

function compact_text(string $text, int $maxChars): string {
    $text = preg_replace('/\s+/', ' ', trim($text));
    if (strlen($text) <= $maxChars) {
        return $text;
    }
    return substr($text, 0, $maxChars - 20) . '... [shortened]';
}

function relevance_score(string $text, string $question): int {
    $text = strtolower($text);
    $words = preg_split('/[^a-z0-9@._-]+/i', strtolower($question));
    $score = 0;
    foreach ($words as $word) {
        if (strlen($word) < 3) {
            continue;
        }
        if (strpos($text, $word) !== false) {
            $score += 3;
        }
    }
    return $score;
}

function focus_people(array $people, string $question): array {
    $questionText = ' ' . strtolower($question) . ' ';
    $matches = [];
    foreach ($people as $person) {
        $terms = array_filter([
            (string) ($person['name'] ?? ''),
            (string) ($person['linked_username'] ?? ''),
            (string) ($person['linked_full_name'] ?? ''),
        ], function ($term) {
            return strlen(trim($term)) >= 3;
        });
        foreach ([(string) ($person['name'] ?? ''), (string) ($person['linked_full_name'] ?? '')] as $nameValue) {
            foreach (preg_split('/[^a-z0-9@._-]+/i', strtolower($nameValue)) as $token) {
                if (strlen($token) >= 3) {
                    $terms[] = $token;
                }
            }
        }

        foreach ($terms as $term) {
            if (term_in_question($questionText, $term)) {
                $matches[] = $person;
                break;
            }
        }
    }
    return $matches;
}

function term_in_question(string $questionText, string $term): bool {
    $term = strtolower(trim($term));
    if ($term === '') {
        return false;
    }
    $quoted = preg_quote($term, '/');
    return (bool) preg_match('/(?<![a-z0-9@._-])' . $quoted . '(?![a-z0-9@._-])/i', $questionText);
}

function focus_terms(array $people, string $question): array {
    $terms = local_keywords($question);
    foreach ($people as $person) {
        foreach (['name', 'linked_username', 'linked_full_name'] as $field) {
            $value = trim((string) ($person[$field] ?? ''));
            if (strlen($value) >= 3) {
                $terms[] = strtolower($value);
            }
        }
    }
    return array_values(array_unique($terms));
}

function contains_any_term(string $text, array $terms): bool {
    foreach ($terms as $term) {
        $term = trim((string) $term);
        if ($term !== '' && stripos($text, $term) !== false) {
            return true;
        }
    }
    return false;
}

function looks_person_specific(array $people, string $question): bool {
    $questionText = ' ' . strtolower($question) . ' ';
    if (strpos($questionText, ' @') !== false) {
        return true;
    }
    foreach ($people as $person) {
        $terms = [
            (string) ($person['name'] ?? ''),
            (string) ($person['linked_username'] ?? ''),
            (string) ($person['linked_full_name'] ?? ''),
        ];
        foreach ($terms as $term) {
            $term = strtolower(trim($term));
            if (strlen($term) >= 3 && term_in_question($questionText, $term)) {
                return true;
            }
            foreach (preg_split('/[^a-z0-9@._-]+/i', $term) as $token) {
                if (strlen($token) >= 4 && term_in_question($questionText, $token)) {
                    return true;
                }
            }
        }
    }
    return false;
}

function ensure_universal_chat_tables(mysqli $conn): void {
    $conn->query(
        "CREATE TABLE IF NOT EXISTS diary_universal_chats (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id INT NOT NULL,
            title VARCHAR(180) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_universal_chats_user_date (user_id, updated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $conn->query(
        "CREATE TABLE IF NOT EXISTS diary_universal_chat_messages (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            session_id INT UNSIGNED NOT NULL,
            user_id INT NOT NULL,
            role ENUM('user', 'assistant') NOT NULL,
            message MEDIUMTEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_universal_messages_session_date (session_id, created_at),
            KEY idx_universal_messages_user_date (user_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

function create_universal_session(mysqli $conn, int $userId): int {
    $stmt = $conn->prepare('INSERT INTO diary_universal_chats (user_id, title) VALUES (?, ?)');
    $title = 'New universal chat';
    $stmt->bind_param('is', $userId, $title);
    $stmt->execute();
    return (int) $stmt->insert_id;
}

function latest_universal_session(mysqli $conn, int $userId): int {
    $stmt = $conn->prepare('SELECT id FROM diary_universal_chats WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1');
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    return $row ? (int) $row['id'] : 0;
}

function assert_universal_session_owner(mysqli $conn, int $sessionId, int $userId): void {
    $stmt = $conn->prepare('SELECT id FROM diary_universal_chats WHERE id = ? AND user_id = ? LIMIT 1');
    $stmt->bind_param('ii', $sessionId, $userId);
    $stmt->execute();
    if (!$stmt->get_result()->fetch_assoc()) {
        json_response(['status' => 'error', 'message' => 'Universal chat was not found'], 404);
    }
}

function save_universal_message(mysqli $conn, int $sessionId, int $userId, string $role, string $message): int {
    $role = $role === 'assistant' ? 'assistant' : 'user';
    $stmt = $conn->prepare('INSERT INTO diary_universal_chat_messages (session_id, user_id, role, message) VALUES (?, ?, ?, ?)');
    $stmt->bind_param('iiss', $sessionId, $userId, $role, $message);
    $stmt->execute();

    $title = compact_text($message, 170);
    if ($role === 'user') {
        $update = $conn->prepare('UPDATE diary_universal_chats SET title = IF(title = ? OR title IS NULL, ?, title), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?');
        $defaultTitle = 'New universal chat';
        $update->bind_param('ssii', $defaultTitle, $title, $sessionId, $userId);
        $update->execute();
    } else {
        $touch = $conn->prepare('UPDATE diary_universal_chats SET updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?');
        $touch->bind_param('ii', $sessionId, $userId);
        $touch->execute();
    }

    return (int) $stmt->insert_id;
}

function universal_messages(mysqli $conn, int $sessionId, int $userId, int $limit = 80): array {
    $limit = max(1, min($limit, 120));
    $stmt = $conn->prepare(
        "SELECT id, role, message, created_at
         FROM diary_universal_chat_messages
         WHERE session_id = ? AND user_id = ?
         ORDER BY created_at DESC, id DESC
         LIMIT $limit"
    );
    $stmt->bind_param('ii', $sessionId, $userId);
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    return array_reverse($rows);
}

function universal_history_text(array $history): string {
    $lines = [];
    foreach ($history as $item) {
        $role = $item['role'] === 'assistant' ? 'Assistant' : 'User';
        $lines[] = "$role: " . compact_text((string) $item['message'], 700);
    }
    return $lines ? implode("\n", $lines) : 'No previous universal chat yet.';
}

function ensure_people_tables(mysqli $conn): void {
    $conn->query(
        "CREATE TABLE IF NOT EXISTS diary_people (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id INT NOT NULL,
            name VARCHAR(160) NOT NULL,
            details TEXT NULL,
            linked_user_id INT NULL,
            linked_username VARCHAR(160) NULL,
            linked_email VARCHAR(255) NULL,
            linked_full_name VARCHAR(255) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_diary_people_user (user_id, name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    foreach ([
        'linked_user_id INT NULL',
        'linked_username VARCHAR(160) NULL',
        'linked_email VARCHAR(255) NULL',
        'linked_full_name VARCHAR(255) NULL',
    ] as $definition) {
        $column = strtok($definition, ' ');
        if (!column_exists($conn, 'diary_people', $column)) {
            $conn->query("ALTER TABLE diary_people ADD COLUMN $definition");
        }
    }

    $conn->query(
        "CREATE TABLE IF NOT EXISTS diary_person_entries (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            person_id INT UNSIGNED NOT NULL,
            user_id INT NOT NULL,
            entry_date DATE NOT NULL,
            knowledge TEXT NULL,
            behavior TEXT NULL,
            notes TEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_person_entries_person_date (person_id, entry_date),
            KEY idx_person_entries_user_date (user_id, entry_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

function list_people(mysqli $conn, int $userId): array {
    $stmt = $conn->prepare('SELECT id, name, details, linked_user_id, linked_username, linked_email, linked_full_name, created_at, updated_at FROM diary_people WHERE user_id = ? ORDER BY updated_at DESC, name ASC');
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $people = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

    $entryStmt = $conn->prepare(
        'SELECT id, entry_date, knowledge, behavior, notes, created_at
         FROM diary_person_entries
         WHERE person_id = ? AND user_id = ?
         ORDER BY entry_date DESC, id DESC
         LIMIT 100'
    );
    foreach ($people as &$person) {
        $personId = (int) $person['id'];
        $entryStmt->bind_param('ii', $personId, $userId);
        $entryStmt->execute();
        $person['entries'] = $entryStmt->get_result()->fetch_all(MYSQLI_ASSOC);
    }
    unset($person);
    return $people;
}

function linked_user_context(mysqli $conn, string $table, string $textColumn, string $dateColumn, int $currentUserId, array $person): array {
    $linkedUserId = (int) ($person['linked_user_id'] ?? 0);
    $linkedEmail = trim((string) ($person['linked_email'] ?? ''));
    if ($linkedUserId <= 0 && $linkedEmail === '') {
        return [];
    }

    $lines = [];

    $sharedIds = shared_entry_ids_between($conn, $table, $currentUserId, $linkedUserId, $linkedEmail);
    if ($sharedIds) {
        $ids = implode(',', array_map('intval', array_slice($sharedIds, 0, 60)));
        $stmt = $conn->prepare("SELECT LEFT($textColumn, 1400) AS entry_text, $dateColumn AS created_at FROM $table WHERE id IN ($ids) ORDER BY $dateColumn DESC LIMIT 60");
        $stmt->execute();
        foreach ($stmt->get_result()->fetch_all(MYSQLI_ASSOC) as $row) {
            $lines[] = "- Shared note with linked user {$row['created_at']}: " . compact_text((string) $row['entry_text'], 900);
        }
    }

    return array_values(array_unique($lines));
}

function shared_entry_ids_between(mysqli $conn, string $diaryTable, int $currentUserId, int $linkedUserId, string $linkedEmail): array {
    $ids = [];
    foreach (['entry_collaborators', 'diary_collaborators', 'diary_entry_collaborators', 'collaborators'] as $collabTable) {
        if (!table_exists($conn, $collabTable)) {
            continue;
        }
        $entryColumn = first_existing_column($conn, $collabTable, ['entry_id', 'diary_entry_id', 'note_id']);
        if ($entryColumn === '') {
            continue;
        }
        $userColumn = first_existing_column($conn, $collabTable, ['user_id', 'collaborator_id', 'friend_id']);
        $emailColumn = first_existing_column($conn, $collabTable, ['user_email', 'collaborator_email', 'friend_email', 'email']);
        $conditions = [];
        $types = '';
        $values = [];
        if ($linkedUserId > 0 && $userColumn !== '') {
            $conditions[] = "$userColumn = ?";
            $types .= 'i';
            $values[] = $linkedUserId;
        }
        if ($linkedEmail !== '' && $emailColumn !== '') {
            $conditions[] = "$emailColumn = ?";
            $types .= 's';
            $values[] = $linkedEmail;
        }
        if (!$conditions) {
            continue;
        }
        $status = column_exists($conn, $collabTable, 'status') ? " AND (status IS NULL OR status IN ('accepted', 'active', 'approved'))" : '';
        $stmt = $conn->prepare("SELECT DISTINCT $entryColumn AS entry_id FROM $collabTable WHERE (" . implode(' OR ', $conditions) . ")$status LIMIT 120");
        bind_dynamic($stmt, $types, $values);
        $stmt->execute();
        foreach ($stmt->get_result()->fetch_all(MYSQLI_ASSOC) as $row) {
            $entryId = (int) $row['entry_id'];
            if ($entryId > 0 && user_can_access_shared_entry($conn, $diaryTable, $collabTable, $entryColumn, $userColumn, $entryId, $currentUserId)) {
                $ids[] = $entryId;
            }
        }
    }
    return array_values(array_unique(array_filter($ids)));
}

function user_can_access_shared_entry(mysqli $conn, string $diaryTable, string $collabTable, string $entryColumn, string $userColumn, int $entryId, int $currentUserId): bool {
    if (column_exists($conn, $diaryTable, 'user_id')) {
        $stmt = $conn->prepare("SELECT id FROM $diaryTable WHERE id = ? AND user_id = ? LIMIT 1");
        $stmt->bind_param('ii', $entryId, $currentUserId);
        $stmt->execute();
        if ($stmt->get_result()->fetch_assoc()) {
            return true;
        }
    }

    if ($userColumn !== '') {
        $status = column_exists($conn, $collabTable, 'status') ? " AND (status IS NULL OR status IN ('accepted', 'active', 'approved'))" : '';
        $stmt = $conn->prepare("SELECT $entryColumn FROM $collabTable WHERE $entryColumn = ? AND $userColumn = ?$status LIMIT 1");
        $stmt->bind_param('ii', $entryId, $currentUserId);
        $stmt->execute();
        return (bool) $stmt->get_result()->fetch_assoc();
    }

    return false;
}

function first_existing_column(mysqli $conn, string $table, array $columns): string {
    foreach ($columns as $column) {
        if (column_exists($conn, $table, $column)) {
            return $column;
        }
    }
    return '';
}

function ai_answer(string $system, string $prompt): array {
    $sarvamKey = app_secret('SARVAM_API_KEY');
    if ($sarvamKey === '') {
        return [
            'provider' => 'local journal reader',
            'text' => local_context_answer($prompt),
        ];
    }

    $response = curl_json('https://api.sarvam.ai/v1/chat/completions', [
        'method' => 'POST',
        'headers' => [
            'Content-Type: application/json',
            'api-subscription-key: ' . $sarvamKey,
        ],
        'body' => [
            'model' => app_secret('SARVAM_MODEL') ?: 'sarvam-30b',
            'messages' => [
                ['role' => 'system', 'content' => $system],
                ['role' => 'user', 'content' => $prompt],
            ],
            'temperature' => 0.3,
            'top_p' => 1,
            'max_tokens' => 520,
        ],
    ]);

    $text = isset($response['_error']) ? '' : trim($response['choices'][0]['message']['content'] ?? '');
    $error = isset($response['_error']) ? ai_error_message($response) : '';
    return [
        'provider' => $text === '' ? 'local journal reader' : 'Sarvam AI',
        'text' => $text !== '' ? $text : local_context_answer($prompt, $error),
    ];
}

function local_context_answer(string $prompt, string $error = ''): string {
    $question = '';
    if (preg_match('/User question:\s*(.+)$/is', $prompt, $match)) {
        $question = trim($match[1]);
    }

    $context = $prompt;
    if (preg_match('/All saved journal context:\s*(.*?)\n\nRecent universal chat:/is', $prompt, $match)) {
        $context = trim($match[1]);
    } else {
        $context = preg_replace('/User question:\s*.+$/is', '', $prompt);
    }
    $focusPerson = '';
    if (preg_match('/Focus person:\s*([^.]+)\./i', $context, $focusMatch)) {
        $focusPerson = trim($focusMatch[1]);
    }
    $isCountQuestion = (bool) preg_match('/\b(how many|count|number of|total)\b/i', $question);
    $lines = preg_split('/\R+/', (string) $context);
    $matches = [];
    $seenEntryIds = [];

    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || strpos($line, 'Relevant compact journal context') !== false || stripos($line, 'People records:') !== false || stripos($line, 'Focus person:') === 0) {
            continue;
        }
        if ($focusPerson !== '') {
            $memoryPattern = '/^\s*' . preg_quote($focusPerson, '/') . '\s+memory on\s+/i';
            $detailsPattern = '/^-\s*' . preg_quote($focusPerson, '/') . '\s*\|/i';
            $sharedPattern = '/^-\s*Shared note with linked user\s+/i';
            if (!preg_match($memoryPattern, $line) && !preg_match($detailsPattern, $line) && !preg_match($sharedPattern, $line)) {
                continue;
            }
        }
        if (preg_match('/Note ID\s+(\d+)/i', $line, $idMatch)) {
            $seenEntryIds[(int) $idMatch[1]] = true;
        }
        if ($isCountQuestion && $focusPerson !== '') {
            continue;
        }
        $score = $focusPerson !== '' ? 50 : relevance_score($line, $question);
        if ($focusPerson === '') {
            if (preg_match('/^-\s*([^|:]+)\s*\|/i', $line, $personMatch)) {
                $personName = trim($personMatch[1]);
                if ($personName !== '' && stripos($question, $personName) !== false) {
                    $score += 20;
                }
            }
            if (preg_match('/^\s*([^\s]+)\s+memory on\s+/i', $line, $memoryMatch)) {
                $personName = trim($memoryMatch[1]);
                if ($personName !== '' && stripos($question, $personName) !== false) {
                    $score += 20;
                }
            }
            foreach (local_keywords($question) as $keyword) {
                if (stripos($line, $keyword) !== false) {
                    $score += 5;
                }
            }
        }
        if ($score > 0) {
            $matches[] = ['score' => $score, 'line' => $line];
        }
    }

    if ($isCountQuestion && $focusPerson !== '') {
        $count = count($seenEntryIds);
        return "You have $count saved person " . ($count === 1 ? 'entry' : 'entries') . " for $focusPerson.";
    }

    usort($matches, function ($a, $b) {
        return $b['score'] <=> $a['score'];
    });

    if (!$matches) {
        return "I checked your saved journals locally, but I could not find a clear saved fact matching this question yet. Add more daily notes about this person, then ask again." . ($error !== '' ? "\n\nAI connection detail: $error" : '');
    }

    $selected = array_slice(array_column($matches, 'line'), 0, 10);
    $answer = $focusPerson !== '' ? "From your saved notes for $focusPerson:\n" : "From your saved journal data, I found this:\n";
    foreach ($selected as $line) {
        $answer .= "\n- " . compact_text($line, 500);
    }
    $answer .= "\n\nDecision note: use only these saved facts as evidence. If something important is not written here yet, treat it as unknown.";
    if ($error !== '') {
        $answer .= "\n\nAI connection detail: $error";
    }
    return $answer;
}

function local_keywords(string $question): array {
    $words = preg_split('/[^a-z0-9@._-]+/i', strtolower($question));
    $keywords = [];
    foreach ($words as $word) {
        if (strlen($word) >= 3 && !in_array($word, ['tell', 'about', 'what', 'know', 'from', 'journal', 'journals'], true)) {
            $keywords[] = $word;
        }
    }
    return array_values(array_unique($keywords));
}

function ai_error_message(array $response): string {
    $code = (int) ($response['_http_code'] ?? 0);
    $body = trim((string) ($response['_body'] ?? ''));
    if ($body !== '') {
        $decoded = json_decode($body, true);
        if (is_array($decoded)) {
            $detail = $decoded['detail'] ?? $decoded['message'] ?? $decoded['error'] ?? '';
            if (is_array($detail)) {
                $detail = json_encode($detail);
            }
            if (is_string($detail) && trim($detail) !== '') {
                return ($code > 0 ? "HTTP $code: " : '') . trim($detail);
            }
        }
    }
    return trim(($code > 0 ? "HTTP $code: " : '') . (string) ($response['_error'] ?? 'Unknown AI error'));
}
?>
