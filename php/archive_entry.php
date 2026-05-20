<?php
require_once __DIR__ . '/api_helpers.php';

$data = input_json();
$email = clean_email($data['email'] ?? $data['user_email'] ?? '');
$entryId = (int) ($data['entry_id'] ?? 0);
$archive = filter_var($data['archive'] ?? true, FILTER_VALIDATE_BOOLEAN);

if ($entryId <= 0) {
    json_response(['status' => 'error', 'message' => 'Entry id is required'], 400);
}

$userId = require_user_id($conn, $email);
$table = diary_table($conn);
ensure_diary_share_tables($conn);

if (!user_can_read_entry($conn, $table, $entryId, $userId, $email)) {
    json_response(['status' => 'error', 'message' => 'Entry not found or you cannot access this note'], 404);
}

if ($archive) {
    $stmt = $conn->prepare('INSERT IGNORE INTO diary_archives (entry_id, user_id, archived_at) VALUES (?, ?, NOW())');
    $stmt->bind_param('ii', $entryId, $userId);
    if (!$stmt->execute()) {
        json_response(['status' => 'error', 'message' => 'Could not archive entry'], 500);
    }
} else {
    $stmt = $conn->prepare('DELETE FROM diary_archives WHERE entry_id = ? AND user_id = ?');
    $stmt->bind_param('ii', $entryId, $userId);
    if (!$stmt->execute()) {
        json_response(['status' => 'error', 'message' => 'Could not restore entry'], 500);
    }
}

json_response([
    'status' => 'success',
    'entry_id' => $entryId,
    'archived' => $archive,
]);
?>
