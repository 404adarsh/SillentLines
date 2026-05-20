<?php
require_once __DIR__ . '/api_helpers.php';

function ensure_programming_journal_table(mysqli $conn): void {
    $conn->query(
        "CREATE TABLE IF NOT EXISTS programming_journals (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id INT NOT NULL,
            title VARCHAR(160) NOT NULL,
            language VARCHAR(40) NOT NULL DEFAULT 'html',
            tags VARCHAR(255) NOT NULL DEFAULT '',
            html_code MEDIUMTEXT NOT NULL,
            css_code MEDIUMTEXT NOT NULL,
            js_code MEDIUMTEXT NOT NULL,
            notes MEDIUMTEXT NOT NULL,
            goal TEXT NULL,
            bug_notes TEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_programming_user_updated (user_id, updated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

$method = $_SERVER['REQUEST_METHOD'];
$data = $method === 'GET' ? $_GET : input_json();
$email = clean_email($data['email'] ?? '');
$userId = require_user_id($conn, $email);
ensure_programming_journal_table($conn);

if ($method === 'GET') {
    $entryId = (int) ($data['id'] ?? 0);
    if ($entryId > 0) {
        $stmt = $conn->prepare(
            'SELECT id, title, language, tags, html_code, css_code, js_code, notes, goal, bug_notes, created_at, updated_at
             FROM programming_journals WHERE id = ? AND user_id = ? LIMIT 1'
        );
        $stmt->bind_param('ii', $entryId, $userId);
        $stmt->execute();
        $entry = $stmt->get_result()->fetch_assoc();
        if (!$entry) {
            json_response(['status' => 'error', 'message' => 'Programming journal not found'], 404);
        }
        json_response(['status' => 'success', 'entry' => $entry]);
    }

    $stmt = $conn->prepare(
        'SELECT id, title, language, tags, notes, goal, bug_notes, created_at, updated_at
         FROM programming_journals WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT 80'
    );
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    json_response(['status' => 'success', 'entries' => $stmt->get_result()->fetch_all(MYSQLI_ASSOC) ?: []]);
}

$action = strtolower(trim($data['action'] ?? 'save'));

if ($action === 'delete') {
    $entryId = (int) ($data['id'] ?? 0);
    if ($entryId <= 0) {
        json_response(['status' => 'error', 'message' => 'Entry id is required'], 400);
    }
    $stmt = $conn->prepare('DELETE FROM programming_journals WHERE id = ? AND user_id = ?');
    $stmt->bind_param('ii', $entryId, $userId);
    $stmt->execute();
    json_response(['status' => 'success']);
}

$entryId = (int) ($data['id'] ?? 0);
$title = trim((string) ($data['title'] ?? 'Untitled code note'));
$title = substr($title === '' ? 'Untitled code note' : $title, 0, 160);
$language = preg_replace('/[^a-z0-9_+#.-]/i', '', (string) ($data['language'] ?? 'html')) ?: 'html';
$tags = substr(trim((string) ($data['tags'] ?? '')), 0, 255);
$html = (string) ($data['html_code'] ?? '');
$css = (string) ($data['css_code'] ?? '');
$js = (string) ($data['js_code'] ?? '');
$notes = (string) ($data['notes'] ?? '');
$goal = (string) ($data['goal'] ?? '');
$bugNotes = (string) ($data['bug_notes'] ?? '');

if ($entryId > 0) {
    $stmt = $conn->prepare(
        'UPDATE programming_journals
         SET title = ?, language = ?, tags = ?, html_code = ?, css_code = ?, js_code = ?, notes = ?, goal = ?, bug_notes = ?
         WHERE id = ? AND user_id = ?'
    );
    $stmt->bind_param('sssssssssii', $title, $language, $tags, $html, $css, $js, $notes, $goal, $bugNotes, $entryId, $userId);
    if (!$stmt->execute()) {
        json_response(['status' => 'error', 'message' => 'Could not update programming journal'], 500);
    }
    json_response(['status' => 'success', 'id' => $entryId]);
}

$stmt = $conn->prepare(
    'INSERT INTO programming_journals (user_id, title, language, tags, html_code, css_code, js_code, notes, goal, bug_notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
);
$stmt->bind_param('isssssssss', $userId, $title, $language, $tags, $html, $css, $js, $notes, $goal, $bugNotes);
if (!$stmt->execute()) {
    json_response(['status' => 'error', 'message' => 'Could not save programming journal'], 500);
}

json_response(['status' => 'success', 'id' => $stmt->insert_id]);
?>
