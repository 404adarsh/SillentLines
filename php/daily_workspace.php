<?php
require_once __DIR__ . '/api_helpers.php';

function ensure_daily_workspace_table(mysqli $conn): void {
    $conn->query(
        "CREATE TABLE IF NOT EXISTS daily_workspace_entries (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id INT NOT NULL,
            entry_date DATE NOT NULL,
            mood VARCHAR(40) NOT NULL DEFAULT '',
            energy TINYINT UNSIGNED NOT NULL DEFAULT 3,
            focus_area VARCHAR(80) NOT NULL DEFAULT '',
            intention TEXT NULL,
            quick_note MEDIUMTEXT NULL,
            ai_reflection MEDIUMTEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_daily_workspace_user_date (user_id, entry_date),
            KEY idx_daily_workspace_user_updated (user_id, updated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

$method = $_SERVER['REQUEST_METHOD'];
$data = $method === 'GET' ? $_GET : input_json();
$email = clean_email($data['email'] ?? '');
$userId = require_user_id($conn, $email);
ensure_daily_workspace_table($conn);

if ($method === 'GET') {
    $stmt = $conn->prepare(
        'SELECT id, entry_date, mood, energy, focus_area, intention, quick_note, ai_reflection, created_at, updated_at
         FROM daily_workspace_entries
         WHERE user_id = ?
         ORDER BY entry_date DESC, id DESC
         LIMIT 30'
    );
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    json_response(['status' => 'success', 'entries' => $stmt->get_result()->fetch_all(MYSQLI_ASSOC) ?: []]);
}

$mood = preg_replace('/[^a-z_ -]/i', '', (string) ($data['mood'] ?? ''));
$energy = max(1, min(5, (int) ($data['energy'] ?? 3)));
$focusArea = substr(preg_replace('/[^a-z0-9_ -]/i', '', (string) ($data['focus_area'] ?? 'personal')), 0, 80);
$intention = trim((string) ($data['intention'] ?? ''));
$quickNote = trim((string) ($data['quick_note'] ?? ''));
$entryDate = date('Y-m-d');

$reflection = daily_ai_reflection($mood, $energy, $focusArea, $intention, $quickNote);

$stmt = $conn->prepare(
    'INSERT INTO daily_workspace_entries (user_id, entry_date, mood, energy, focus_area, intention, quick_note, ai_reflection)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
        mood = VALUES(mood),
        energy = VALUES(energy),
        focus_area = VALUES(focus_area),
        intention = VALUES(intention),
        quick_note = VALUES(quick_note),
        ai_reflection = VALUES(ai_reflection)'
);
$stmt->bind_param('ississss', $userId, $entryDate, $mood, $energy, $focusArea, $intention, $quickNote, $reflection['text']);
if (!$stmt->execute()) {
    json_response(['status' => 'error', 'message' => 'Could not save daily workspace'], 500);
}

json_response([
    'status' => 'success',
    'id' => $stmt->insert_id,
    'entry_date' => $entryDate,
    'reflection' => $reflection['text'],
    'provider' => $reflection['provider'],
]);

function daily_ai_reflection(string $mood, int $energy, string $focusArea, string $intention, string $quickNote): array {
    $fallback = daily_local_reflection($mood, $energy, $focusArea, $intention, $quickNote);
    $sarvamKey = app_secret('SARVAM_API_KEY');
    if ($sarvamKey === '') {
        return ['provider' => 'local daily coach', 'text' => $fallback];
    }

    $prompt = "Create a detailed daily workspace reflection for a journaling app user. " .
        "Read the user's quick note and intention carefully. Do not answer generically. Explain what you understood in your own words, as if you are their close friend who actually listened. " .
        "Console the user when they sound sad, tired, afraid, ashamed, confused, or disappointed. Give firm practical advice based on mood, energy, focus area, intention, and quick note. " .
        "Tell them what they can do, what they must do, what they should stop doing, and what one small plan for today should be. " .
        "If the user is avoiding the obvious next step, gently scold them with care. Keep it respectful, never insulting or shaming. " .
        "If the user mentions study, exams, code, work, business, relationships, or personal pain, respond specifically to that topic. " .
        "Do not give medical, legal, or financial advice. Use these sections: 1) What I understood, 2) First, breathe, 3) Honest advice, 4) What you can do, 5) What you must do, 6) Stop doing this, 7) Today's small plan, 8) Come back cue. " .
        "Mood: $mood. Energy 1-5: $energy. Focus area: $focusArea. Intention: $intention. Quick note: $quickNote.";

    $response = curl_json('https://api.sarvam.ai/v1/chat/completions', [
        'method' => 'POST',
        'headers' => [
            'Content-Type: application/json',
            'api-subscription-key: ' . $sarvamKey,
        ],
        'body' => [
            'model' => app_secret('SARVAM_MODEL') ?: 'sarvam-30b',
            'messages' => [
                ['role' => 'system', 'content' => 'You are a warm, honest daily companion for a private journal app. Talk like a close friend: console, explain, advise, and gently scold avoidance when needed. Be detailed and practical. Avoid medical, legal, or financial advice.'],
                ['role' => 'user', 'content' => $prompt],
            ],
            'temperature' => 0.72,
            'top_p' => 1,
            'max_tokens' => 950,
        ],
    ]);

    $text = isset($response['_error']) ? '' : trim($response['choices'][0]['message']['content'] ?? '');
    return [
        'provider' => $text === '' ? 'local daily coach' : 'Sarvam AI',
        'text' => $text !== '' ? $text : $fallback,
    ];
}

function daily_local_reflection(string $mood, int $energy, string $focusArea, string $intention, string $quickNote): string {
    $moodText = $mood !== '' ? $mood : 'not named yet';
    $focusText = $focusArea !== '' ? $focusArea : 'today';
    $intentText = $intention !== '' ? $intention : 'choose one small honest action';
    $noteText = $quickNote !== '' ? " Your note says: $quickNote" : '';

    $lowEnergy = $energy <= 2 || in_array(strtolower($moodText), ['tired', 'heavy', 'sad'], true);
    $honest = $lowEnergy
        ? 'Your honest move is to reduce the size of the day. You are not weak for having low energy, but you still need one tiny action so the day does not completely slip away.'
        : 'Your honest move is to stop negotiating with distraction and give one task a real block of attention.';

    return "What I understood\nYour mood is $moodText, your energy is $energy/5, and your focus is $focusText.$noteText This tells me today needs clarity more than pressure.\n\n" .
        "First, breathe\nYou do not need to fix your whole life in one sitting. Come back to the next honest step. That is where control starts.\n\n" .
        "Honest advice\n$honest\n\n" .
        "What you can do\nStart with this: $intentText. Make it a 10-minute beginning, not a perfect plan. Keep the task visible and small enough that you cannot argue with it.\n\n" .
        "What you must do\nYou must protect your attention. Put away the easiest distraction before you start. If you let the distraction sit beside you, do not act shocked when it wins.\n\n" .
        "Stop doing this\nStop waiting until you feel fully ready. Ready comes after movement, not before it.\n\n" .
        "Today's small plan\n1. Set a 10-minute timer.\n2. Do only the first visible step for $focusText.\n3. Write one line about what changed.\n\n" .
        "Come back cue\nTonight, return here and answer: did I keep the promise small enough to complete?";
}
?>
