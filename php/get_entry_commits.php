<?php
require_once __DIR__ . '/api_helpers.php';

$data = input_json();
$email = clean_email($data['email'] ?? $data['user_email'] ?? $data['owner_email'] ?? '');
$entryId = (int) ($data['entry_id'] ?? $data['id'] ?? 0);

if ($entryId <= 0) {
    json_response(['status' => 'error', 'message' => 'Entry id is required'], 400);
}

$userId = require_user_id($conn, $email);
$profile = user_profile($conn, $email);
$ownerId = (int) ($profile['id'] ?? $userId);
$table = diary_table($conn);
$hasCollaborators = table_exists($conn, 'diary_collaborators');

$accessSql = "SELECT d.id FROM $table d";
$types = '';
$values = [];
if ($hasCollaborators) {
    $accessSql .= " LEFT JOIN diary_collaborators c ON c.entry_id = d.id AND c.user_id = ? AND c.status = 'accepted'";
    $types .= 'i';
    $values[] = $userId;
}
$accessSql .= ' WHERE d.id = ? AND (';
$types .= 'i';
$values[] = $entryId;

$filters = [];
if (column_exists($conn, $table, 'user_id')) {
    $filters[] = 'd.user_id = ?';
    $types .= 'i';
    $values[] = $userId;
}
if (column_exists($conn, $table, 'owner_id')) {
    $filters[] = 'd.owner_id = ?';
    $types .= 'i';
    $values[] = $ownerId;
}
if (column_exists($conn, $table, 'user_email')) {
    $filters[] = 'LOWER(d.user_email) = LOWER(?)';
    $types .= 's';
    $values[] = $email;
}
if (column_exists($conn, $table, 'owner_email')) {
    $filters[] = 'LOWER(d.owner_email) = LOWER(?)';
    $types .= 's';
    $values[] = $email;
}
if (column_exists($conn, $table, 'email')) {
    $filters[] = 'LOWER(d.email) = LOWER(?)';
    $types .= 's';
    $values[] = $email;
}
if ($hasCollaborators) {
    $filters[] = 'c.id IS NOT NULL';
}
if (!$filters) {
    json_response(['status' => 'error', 'message' => 'Diary table has no supported owner column'], 500);
}

$accessSql .= implode(' OR ', $filters) . ') LIMIT 1';
$accessStmt = $conn->prepare($accessSql);
if (!$accessStmt) {
    json_response(['status' => 'error', 'message' => 'Access check failed: ' . $conn->error], 500);
}
bind_dynamic($accessStmt, $types, $values);
$accessStmt->execute();
if (!$accessStmt->get_result()->fetch_assoc()) {
    json_response(['status' => 'error', 'message' => 'Entry not found or you cannot access this note'], 404);
}

ensure_diary_commit_tables($conn);
$stmt = $conn->prepare(
    'SELECT id, entry_id, author_user_id, author_email, author_name, author_username, commit_message,
            before_title, after_title, before_text, after_text, before_emotion, after_emotion,
            before_diary_date, after_diary_date, changed_fields, created_at
     FROM diary_entry_commits
     WHERE entry_id = ?
     ORDER BY created_at DESC, id DESC'
);
if (!$stmt) {
    json_response(['status' => 'error', 'message' => 'Query prepare failed: ' . $conn->error], 500);
}
$stmt->bind_param('i', $entryId);
if (!$stmt->execute()) {
    json_response(['status' => 'error', 'message' => 'Query execute failed: ' . $stmt->error], 500);
}

$commits = $stmt->get_result()->fetch_all(MYSQLI_ASSOC) ?: [];
foreach ($commits as &$commit) {
    $commit['changed_fields'] = array_values(array_filter(explode(',', (string) ($commit['changed_fields'] ?? ''))));
    $commit['author_label'] = ($commit['author_name'] ?? '') ?: (($commit['author_username'] ?? '') ?: $commit['author_email']);
}
unset($commit);

json_response(['status' => 'success', 'count' => count($commits), 'commits' => $commits]);
?>
