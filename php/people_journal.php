<?php
require_once __DIR__ . '/api_helpers.php';

$data = input_json();
$email = clean_email($data['email'] ?? '');
$userId = require_user_id($conn, $email);
$action = preg_replace('/[^a-z_]/i', '', $data['action'] ?? 'list') ?: 'list';

ensure_people_tables($conn);

if ($action === 'create_person') {
    $name = trim($data['name'] ?? '');
    $details = trim($data['details'] ?? '');
    $linkedUserId = (int) ($data['linked_user_id'] ?? 0);
    if ($name === '') {
        json_response(['status' => 'error', 'message' => 'Person name is required'], 400);
    }

    $linked = $linkedUserId > 0 ? lookup_diary_user($conn, $linkedUserId) : null;
    $linkedId = $linked ? (int) $linked['id'] : null;
    $linkedUsername = $linked['username'] ?? null;
    $linkedEmail = $linked['email'] ?? null;
    $linkedFullName = $linked['full_name'] ?? null;

    $stmt = $conn->prepare('INSERT INTO diary_people (user_id, name, details, linked_user_id, linked_username, linked_email, linked_full_name) VALUES (?, ?, ?, ?, ?, ?, ?)');
    $stmt->bind_param('ississs', $userId, $name, $details, $linkedId, $linkedUsername, $linkedEmail, $linkedFullName);
    $stmt->execute();
    json_response(['status' => 'success', 'person_id' => $stmt->insert_id]);
}

if ($action === 'update_person') {
    $personId = (int) ($data['person_id'] ?? 0);
    $name = trim($data['name'] ?? '');
    $details = trim($data['details'] ?? '');
    $linkedUserId = (int) ($data['linked_user_id'] ?? 0);
    if ($personId <= 0 || $name === '') {
        json_response(['status' => 'error', 'message' => 'Person and name are required'], 400);
    }

    $linked = $linkedUserId > 0 ? lookup_diary_user($conn, $linkedUserId) : null;
    $linkedId = $linked ? (int) $linked['id'] : null;
    $linkedUsername = $linked['username'] ?? null;
    $linkedEmail = $linked['email'] ?? null;
    $linkedFullName = $linked['full_name'] ?? null;

    $stmt = $conn->prepare('UPDATE diary_people SET name = ?, details = ?, linked_user_id = ?, linked_username = ?, linked_email = ?, linked_full_name = ? WHERE id = ? AND user_id = ?');
    $stmt->bind_param('ssisssii', $name, $details, $linkedId, $linkedUsername, $linkedEmail, $linkedFullName, $personId, $userId);
    $stmt->execute();
    json_response(['status' => 'success']);
}

if ($action === 'search_users') {
    $query = trim($data['query'] ?? '');
    if (strlen($query) < 1) {
        json_response(['status' => 'success', 'users' => []]);
    }
    $like = '%' . $query . '%';
    $stmt = $conn->prepare(
        'SELECT id, username, full_name
         FROM diaryusers
         WHERE id <> ? AND (username LIKE ? OR full_name LIKE ?)
         ORDER BY username ASC
         LIMIT 12'
    );
    $stmt->bind_param('iss', $userId, $like, $like);
    $stmt->execute();
    json_response(['status' => 'success', 'current_user_id' => $userId, 'users' => $stmt->get_result()->fetch_all(MYSQLI_ASSOC)]);
}

if ($action === 'delete_person') {
    $personId = (int) ($data['person_id'] ?? 0);
    assert_person_owner($conn, $personId, $userId);

    $chatStmt = $conn->prepare('DELETE FROM diary_person_chats WHERE person_id = ? AND user_id = ?');
    $chatStmt->bind_param('ii', $personId, $userId);
    $chatStmt->execute();

    $entryStmt = $conn->prepare('DELETE FROM diary_person_entries WHERE person_id = ? AND user_id = ?');
    $entryStmt->bind_param('ii', $personId, $userId);
    $entryStmt->execute();

    $personStmt = $conn->prepare('DELETE FROM diary_people WHERE id = ? AND user_id = ?');
    $personStmt->bind_param('ii', $personId, $userId);
    $personStmt->execute();

    json_response(['status' => 'success']);
}

if ($action === 'add_entry') {
    $personId = (int) ($data['person_id'] ?? 0);
    assert_person_owner($conn, $personId, $userId);
    $entryDate = clean_date($data['entry_date'] ?? date('Y-m-d'));
    $knowledge = trim($data['knowledge'] ?? '');
    $behavior = trim($data['behavior'] ?? '');
    $notes = trim($data['notes'] ?? '');
    if ($knowledge === '' && $behavior === '' && $notes === '') {
        json_response(['status' => 'error', 'message' => 'Write at least one detail about this person'], 400);
    }

    $stmt = $conn->prepare(
        'INSERT INTO diary_person_entries (person_id, user_id, entry_date, knowledge, behavior, notes)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    $stmt->bind_param('iissss', $personId, $userId, $entryDate, $knowledge, $behavior, $notes);
    $stmt->execute();
    json_response(['status' => 'success', 'entry_id' => $stmt->insert_id]);
}

if ($action === 'ask_person') {
    $personId = (int) ($data['person_id'] ?? 0);
    $question = trim($data['question'] ?? '');
    $entryId = (int) ($data['entry_id'] ?? 0);
    if ($question === '') {
        json_response(['status' => 'error', 'message' => 'Ask a question first'], 400);
    }
    $person = assert_person_owner($conn, $personId, $userId);
    $context = person_context($conn, $personId, $userId, $person['name']);
    $focusedEntry = focused_person_entry_text($conn, $entryId, $personId, $userId);
    $answer = ai_answer(
        person_ai_system_prompt(),
        "Person: {$person['name']}\nBase details: {$person['details']}\n\nFocused entry:\n$focusedEntry\n\nStored data:\n$context\n\nQuestion: $question"
    );
    json_response(['status' => 'success', 'answer' => $answer['text'], 'provider' => $answer['provider']]);
}

if ($action === 'chat_history') {
    $personId = (int) ($data['person_id'] ?? 0);
    assert_person_owner($conn, $personId, $userId);
    json_response(['status' => 'success', 'messages' => chat_history($conn, $personId, $userId)]);
}

if ($action === 'person_chat') {
    $personId = (int) ($data['person_id'] ?? 0);
    $entryId = (int) ($data['entry_id'] ?? 0);
    $message = trim($data['message'] ?? '');
    if ($message === '') {
        json_response(['status' => 'error', 'message' => 'Write a message first'], 400);
    }
    $person = assert_person_owner($conn, $personId, $userId);

    save_chat_message($conn, $personId, $userId, 'user', $message);
    $history = chat_history($conn, $personId, $userId, 16);
    $context = person_context($conn, $personId, $userId, $person['name']);
    $focusedEntry = focused_person_entry_text($conn, $entryId, $personId, $userId);
    $historyText = chat_history_text($history);
    $answer = ai_answer(
        person_ai_system_prompt(),
        "Person: {$person['name']}\nBase details: {$person['details']}\n\nFocused entry:\n$focusedEntry\n\nSaved memory:\n$context\n\nRecent chat:\n$historyText\n\nLatest user message: $message"
    );
    $messageId = save_chat_message($conn, $personId, $userId, 'assistant', $answer['text']);
    json_response([
        'status' => 'success',
        'answer' => $answer['text'],
        'provider' => $answer['provider'],
        'message_id' => $messageId,
        'messages' => chat_history($conn, $personId, $userId),
    ]);
}

json_response(['status' => 'success', 'people' => public_people(list_people($conn, $userId))]);

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
            KEY idx_diary_people_user (user_id, name),
            KEY idx_diary_people_linked_user (linked_user_id)
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

    $conn->query(
        "CREATE TABLE IF NOT EXISTS diary_person_chats (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            person_id INT UNSIGNED NOT NULL,
            user_id INT NOT NULL,
            role ENUM('user', 'assistant') NOT NULL,
            message MEDIUMTEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_person_chats_person_date (person_id, created_at),
            KEY idx_person_chats_user_date (user_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

function clean_date(string $date): string {
    $date = trim($date);
    return preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) ? $date : date('Y-m-d');
}

function assert_person_owner(mysqli $conn, int $personId, int $userId): array {
    if ($personId <= 0) {
        json_response(['status' => 'error', 'message' => 'Person is required'], 400);
    }
    $stmt = $conn->prepare('SELECT id, name, details, linked_user_id, linked_username, linked_email, linked_full_name FROM diary_people WHERE id = ? AND user_id = ? LIMIT 1');
    $stmt->bind_param('ii', $personId, $userId);
    $stmt->execute();
    $person = $stmt->get_result()->fetch_assoc();
    if (!$person) {
        json_response(['status' => 'error', 'message' => 'Person was not found'], 404);
    }
    return $person;
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
         LIMIT 20'
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

function public_people(array $people): array {
    foreach ($people as &$person) {
        unset($person['linked_email']);
    }
    unset($person);
    return $people;
}

function chat_history(mysqli $conn, int $personId, int $userId, int $limit = 80): array {
    $limit = max(1, min($limit, 120));
    $stmt = $conn->prepare(
        "SELECT id, role, message, created_at
         FROM diary_person_chats
         WHERE person_id = ? AND user_id = ?
         ORDER BY created_at DESC, id DESC
         LIMIT $limit"
    );
    $stmt->bind_param('ii', $personId, $userId);
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    return array_reverse($rows);
}

function save_chat_message(mysqli $conn, int $personId, int $userId, string $role, string $message): int {
    $role = $role === 'assistant' ? 'assistant' : 'user';
    $stmt = $conn->prepare('INSERT INTO diary_person_chats (person_id, user_id, role, message) VALUES (?, ?, ?, ?)');
    $stmt->bind_param('iiss', $personId, $userId, $role, $message);
    $stmt->execute();
    return (int) $stmt->insert_id;
}

function chat_history_text(array $history): string {
    $lines = [];
    foreach ($history as $item) {
        $role = $item['role'] === 'assistant' ? 'Assistant' : 'User';
        $lines[] = "$role: " . compact_text((string) $item['message'], 900);
    }
    return $lines ? implode("\n", $lines) : 'No previous chat yet.';
}

function person_ai_system_prompt(): string {
    return implode(' ', [
        "You are a private diary assistant helping the user understand one specific person and relationship situation.",
        "Use the focused entry first when it is provided, then compare it with saved memories, diary mentions, shared notes, and chat history for repeated patterns.",
        "Answer the user's exact question first. Do not always use the same advice template.",
        "If the user asks what type of talk, term, tone, category, or meaning an entry has, classify and explain the entry directly.",
        "When the user asks for a suggestion, analyze what may have happened, what the possible problem could be, what the user can do next, what to avoid, and what extra information would make the answer clearer.",
        "Separate evidence from interpretation. Use careful language like 'may', 'could', and 'based on your notes' when you infer motives or causes.",
        "Do not diagnose mental health, accuse the other person, claim certainty about private motives, or invent facts not present in the notes.",
        "Be warm, direct, practical, and protective of the user's safety and boundaries.",
    ]);
}

function focused_person_entry_text(mysqli $conn, int $entryId, int $personId, int $userId): string {
    if ($entryId <= 0) {
        return 'No single entry selected. Use the full saved memory and mention when the answer is based on patterns instead of one entry.';
    }

    $stmt = $conn->prepare(
        'SELECT id, entry_date, knowledge, behavior, notes
         FROM diary_person_entries
         WHERE id = ? AND person_id = ? AND user_id = ?
         LIMIT 1'
    );
    $stmt->bind_param('iii', $entryId, $personId, $userId);
    $stmt->execute();
    $entry = $stmt->get_result()->fetch_assoc();
    if (!$entry) {
        return 'The selected entry was not found or does not belong to this person. Use the full saved memory only.';
    }

    return "- Entry {$entry['id']} on {$entry['entry_date']} | Know: " . compact_text((string) $entry['knowledge'], 900) .
        " | Behavior: " . compact_text((string) $entry['behavior'], 900) .
        " | Notes: " . compact_text((string) $entry['notes'], 900);
}

function person_context(mysqli $conn, int $personId, int $userId, string $name): string {
    $maxChars = 30000;
    $stmt = $conn->prepare(
        'SELECT entry_date, knowledge, behavior, notes
         FROM diary_person_entries
         WHERE person_id = ? AND user_id = ?
         ORDER BY entry_date DESC, id DESC
         LIMIT 120'
    );
    $stmt->bind_param('ii', $personId, $userId);
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $parts = ['Compact person context. Long records are shortened to stay inside the AI context window.'];
    foreach ($rows as $row) {
        add_context_line(
            $parts,
            "- {$row['entry_date']} | Know: " . compact_text((string) $row['knowledge'], 450) .
            " | Behavior: " . compact_text((string) $row['behavior'], 450) .
            " | Notes: " . compact_text((string) $row['notes'], 450),
            $maxChars
        );
    }

    $person = assert_person_owner($conn, $personId, $userId);
    $table = diary_table($conn);
    $textColumn = column_exists($conn, $table, 'entry_text') ? 'entry_text' : 'entry';
    $dateColumn = column_exists($conn, $table, 'created_at') ? 'created_at' : 'id';
    $like = '%' . $name . '%';
    $where = "$textColumn LIKE ?";
    $types = 's';
    $values = [$like];
    if (column_exists($conn, $table, 'user_id')) {
        $where = "user_id = ? AND $where";
        $types = 'is';
        $values = [$userId, $like];
    }
    $diaryStmt = $conn->prepare("SELECT LEFT($textColumn, 1400) AS entry_text, $dateColumn AS created_at FROM $table WHERE $where ORDER BY $dateColumn DESC LIMIT 20");
    bind_dynamic($diaryStmt, $types, $values);
    $diaryStmt->execute();
    foreach ($diaryStmt->get_result()->fetch_all(MYSQLI_ASSOC) as $row) {
        add_context_line($parts, "- Diary mention {$row['created_at']}: " . compact_text((string) $row['entry_text'], 900), $maxChars);
    }

    foreach (linked_user_context($conn, $table, $textColumn, $dateColumn, $userId, $person) as $line) {
        add_context_line($parts, $line, $maxChars);
    }

    return $parts ? implode("\n", $parts) : 'No daily notes recorded yet.';
}

function lookup_diary_user(mysqli $conn, int $userId): ?array {
    $stmt = $conn->prepare('SELECT id, username, full_name, email FROM diaryusers WHERE id = ? LIMIT 1');
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    return $row ?: null;
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
        $sql = "SELECT DISTINCT $entryColumn AS entry_id FROM $collabTable WHERE (" . implode(' OR ', $conditions) . ")$status LIMIT 120";
        $stmt = $conn->prepare($sql);
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

function ai_answer(string $system, string $prompt): array {
    $sarvamKey = app_secret('SARVAM_API_KEY');
    if ($sarvamKey === '') {
        return [
            'provider' => 'local journal reader',
            'text' => local_answer($prompt),
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
            'temperature' => 0.35,
            'top_p' => 1,
            'max_tokens' => 420,
        ],
    ]);

    $text = isset($response['_error']) ? '' : trim($response['choices'][0]['message']['content'] ?? '');
    $error = isset($response['_error']) ? ai_error_message($response) : '';
    return [
        'provider' => $text === '' ? 'local journal reader' : 'Sarvam AI',
        'text' => $text !== '' ? $text : local_answer($prompt, $error),
    ];
}

function local_answer(string $prompt, string $error = ''): string {
    $matches = [];
    $person = 'this person';
    $question = '';
    $focused = '';
    foreach (preg_split('/\R+/', $prompt) as $line) {
        $line = trim($line);
        if (stripos($line, 'Person:') === 0) {
            $person = trim(substr($line, strlen('Person:'))) ?: $person;
            continue;
        }
        if (stripos($line, 'Question:') === 0 || stripos($line, 'Latest user message:') === 0) {
            $question = trim(preg_replace('/^(Question:|Latest user message:)/i', '', $line));
            continue;
        }
        if ($line === '') {
            continue;
        }
        if ($focused === '' && stripos($line, '- Entry ') === 0 && stripos($line, '| Know:') !== false) {
            $focused = compact_text($line, 700);
        }
        if (stripos($line, '| Know:') !== false || stripos($line, 'Base details:') === 0 || stripos($line, 'Diary mention') !== false) {
            $matches[] = compact_text($line, 500);
        }
    }

    if (!$matches) {
        return "I checked the saved notes for this person, but there is not enough recorded data yet to answer safely." . ($error !== '' ? "\n\nAI connection detail: $error" : '');
    }

    $entryLine = $focused !== '' ? $focused : $matches[0];
    $entry = parse_person_entry_line($entryLine);
    $intent = person_question_intent($question);
    $hinglish = question_prefers_hinglish($question);

    if ($intent === 'classify') {
        $answer = local_classify_entry_answer($person, $question, $entry, $hinglish);
    } elseif ($intent === 'summarize') {
        $answer = local_summarize_entry_answer($person, $entry, $hinglish);
    } elseif ($intent === 'explain') {
        $answer = local_explain_entry_answer($person, $question, $entry, $hinglish);
    } else {
        $answer = local_advice_entry_answer($person, $question, $entry, array_slice($matches, 0, 4), $hinglish);
    }

    if ($error !== '') {
        $answer .= "\n\nAI connection detail: $error";
    }
    return $answer;
}

function parse_person_entry_line(string $line): array {
    $entry = [
        'date' => '',
        'know' => '',
        'behavior' => '',
        'notes' => '',
        'raw' => compact_text($line, 900),
    ];

    if (preg_match('/(?:Entry\s+\d+\s+on\s+)?(\d{4}-\d{2}-\d{2})/i', $line, $dateMatch)) {
        $entry['date'] = $dateMatch[1];
    }
    if (preg_match('/Know:\s*(.*?)\s*\|\s*Behavior:\s*(.*?)\s*\|\s*Notes:\s*(.*)$/iu', $line, $parts)) {
        $entry['know'] = trim($parts[1]);
        $entry['behavior'] = trim($parts[2]);
        $entry['notes'] = trim($parts[3]);
    }

    return $entry;
}

function person_question_intent(string $question): string {
    $q = strtolower($question);
    if (preg_match('/\b(type|term|category|tone|nature|meaning|matlab|kis type|kaise type|kaisi baat|kya type|classify)\b/i', $q)) {
        return 'classify';
    }
    if (preg_match('/\b(summary|summarize|short|brief|tell me about|entry me kya|kya likha|batao|samjha)\b/i', $q)) {
        return 'summarize';
    }
    if (preg_match('/\b(why|kyu|kaaran|reason|explain|samjhao|understand|matlab)\b/i', $q)) {
        return 'explain';
    }
    return 'advice';
}

function question_prefers_hinglish(string $question): bool {
    return (bool) preg_match('/\b(kya|kyu|kaise|kis|hai|nahi|nhi|bata|batao|samjha|matlab|baat|entry|likha|dairy|diary|vo|ye|jo)\b/i', $question);
}

function entry_combined_text(array $entry): string {
    return trim(($entry['know'] ?? '') . ' ' . ($entry['behavior'] ?? '') . ' ' . ($entry['notes'] ?? ''));
}

function entry_tone_labels(array $entry): array {
    $text = strtolower(entry_combined_text($entry));
    $labels = [];
    if (preg_match('/\b(sex|sexual|maro|meri|dard|bada|gay|kiss|intimate|body)\b/i', $text)) {
        $labels[] = 'sexual/intimate talk';
        $labels[] = 'consent and boundary related';
    }
    if (preg_match('/\b(dard|mar jaunga|mana|dar|hurt|pain|unsafe)\b/i', $text)) {
        $labels[] = 'discomfort or safety concern';
    }
    if (preg_match('/\b(bharosa|trust|nhi|nahi|mana|avoid)\b/i', $text)) {
        $labels[] = 'trust issue';
    }
    if (preg_match('/\b(majak|joke|tease|fun|bola|kaha)\b/i', $text)) {
        $labels[] = 'conversation/behavior note';
    }
    if (!$labels) {
        $labels[] = 'personal observation';
        $labels[] = 'relationship memory';
    }
    return array_values(array_unique($labels));
}

function local_classify_entry_answer(string $person, string $question, array $entry, bool $hinglish): string {
    $labels = entry_tone_labels($entry);
    $labelText = implode(', ', $labels);
    if ($hinglish) {
        return "Is entry ka type mainly: $labelText.\n\nSimple meaning: tumne $person ke saath ek personal/relationship situation note ki hai. Entry me jo baat likhi hai woh normal daily update se zyada boundary, trust, aur intimate/sexual conversation ke zone me aati hai.\n\nImportant point: isko pakka motive ya character certificate mat samjho. Ye bas tumhari saved note ke hisaab se us moment ki category aur tone hai.\n\nAgar tum puch rahe ho 'ye kis type ki baat hai', to answer hai: ye sensitive personal boundary wali baat hai, jisme consent, comfort, trust aur safety clear hona chahiye.";
    }

    return "This entry reads mainly as: $labelText.\n\nIn plain terms, it is not just a casual memory. It is a sensitive personal boundary note about trust, comfort, and possibly intimate conversation.\n\nI would not treat it as proof of the person's motive. I would treat it as a record of a situation where boundaries and comfort need to be clear.";
}

function local_summarize_entry_answer(string $person, array $entry, bool $hinglish): string {
    $date = $entry['date'] !== '' ? " on {$entry['date']}" : '';
    if ($hinglish) {
        return "Short summary$date: tumne $person ke baare me likha ki trust/bharosa aur personal boundary se related concern tha.\n\nKnow: " . (($entry['know'] ?? '') ?: '-') . "\nBehavior: " . (($entry['behavior'] ?? '') ?: '-') . "\nNotes: " . (($entry['notes'] ?? '') ?: '-') . "\n\nSeedha meaning: ye entry tumhari discomfort, trust, aur boundary clarity ke baare me hai.";
    }

    return "Short summary$date: this note about $person is mainly about trust, discomfort, and personal boundaries.\n\nKnow: " . (($entry['know'] ?? '') ?: '-') . "\nBehavior: " . (($entry['behavior'] ?? '') ?: '-') . "\nNotes: " . (($entry['notes'] ?? '') ?: '-') . "\n\nThe safest reading is that this is a boundary/comfort note, not a final judgment about the person.";
}

function local_explain_entry_answer(string $person, string $question, array $entry, bool $hinglish): string {
    if ($hinglish) {
        return "Mere hisaab se is entry ka matlab ye hai: tum $person ke behavior ko samajhne ki koshish kar rahe ho, especially trust aur personal boundary ke angle se.\n\nKya clear dikhta hai\n- Entry me sensitive/personal baat hai.\n- Tumhe doubt ya discomfort feel hua.\n- Final decision ke liye ek entry enough nahi hoti, lekin discomfort ko ignore bhi nahi karna chahiye.\n\nKya unclear hai\nUs person ka real intention note se prove nahi hota. Isliye isko 'possible signal' samjho, final fact nahi.";
    }

    return "This entry seems to be about understanding $person's behavior through the lens of trust and boundaries.\n\nWhat is clear:\n- The note contains a sensitive personal situation.\n- You recorded discomfort or doubt.\n- One entry is not enough to prove intention, but it is enough to notice how the situation made you feel.\n\nWhat is unclear: the person's actual motive. The note can show behavior and impact, not private intention.";
}

function local_advice_entry_answer(string $person, string $question, array $entry, array $evidence, bool $hinglish): string {
    if ($hinglish) {
        $answer = "Is entry par practical suggestion:\n\nProblem kya ho sakti hai\nYaha main issue trust, comfort aur boundary clarity ka lag raha hai. Agar baat sensitive ya intimate thi, to dono side ka clear consent aur comfort important hai.\n\nTum kya kar sakte ho\n1. Pehle khud clear karo ki tum comfortable the ya nahi.\n2. Agar safe lage, seedha pucho: us baat ka matlab kya tha?\n3. Agar tumhe pressure, confusion, ya discomfort feel hua, boundary set karo.\n4. Aage ki entries me exact behavior note karo, sirf feeling nahi.\n\nKya avoid karna hai\nEk hi entry se final judgment mat banao, lekin repeated discomfort ko ignore bhi mat karo.";
    } else {
        $answer = "Practical suggestion for this entry:\n\nPossible problem\nThe main issue appears to be trust, comfort, and boundary clarity. If the situation was sensitive or intimate, clear consent and comfort matter on both sides.\n\nWhat you can do\n1. First name whether you felt comfortable or uncomfortable.\n2. If it feels safe, ask directly what they meant.\n3. If you felt pressured or confused, set a boundary.\n4. In future entries, record exact behavior, not only the feeling.\n\nWhat to avoid\nDo not make a final judgment from one entry, but also do not ignore repeated discomfort.";
    }

    if ($evidence) {
        $answer .= "\n\nEvidence I used";
        foreach ($evidence as $line) {
            $answer .= "\n- " . compact_text($line, 350);
        }
    }
    return $answer;
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
