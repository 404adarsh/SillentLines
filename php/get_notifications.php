<?php
require_once __DIR__ . '/api_helpers.php';

$data = input_json();
$email = clean_email($data['email'] ?? $data['user_email'] ?? '');
ensure_diary_share_tables($conn);

$stmt = $conn->prepare(
    'SELECT id, recipient_email, sender_id, sender_username, entry_id, message, created_at
     FROM diary_notifications
     WHERE LOWER(recipient_email) = LOWER(?) AND is_read = 0
     ORDER BY created_at DESC, id DESC
     LIMIT 40'
);
$stmt->bind_param('s', $email);
$stmt->execute();
$notifications = $stmt->get_result()->fetch_all(MYSQLI_ASSOC) ?: [];

json_response(['status' => 'success', 'notifications' => $notifications]);
?>
