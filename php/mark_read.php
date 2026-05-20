<?php
require_once __DIR__ . '/api_helpers.php';

$data = input_json();
$id = (int) ($data['id'] ?? 0);
if ($id <= 0) {
    json_response(['status' => 'error', 'message' => 'Notification id is required'], 400);
}
ensure_diary_share_tables($conn);

$stmt = $conn->prepare('UPDATE diary_notifications SET is_read = 1 WHERE id = ?');
$stmt->bind_param('i', $id);
if (!$stmt->execute()) {
    json_response(['status' => 'error', 'message' => 'Could not mark notification as read'], 500);
}

json_response(['status' => 'success']);
?>
