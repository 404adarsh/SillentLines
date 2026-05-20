<?php
require_once __DIR__ . '/api_helpers.php';

$method = $_SERVER['REQUEST_METHOD'];
$data = $method === 'GET' ? $_GET : input_json();
$email = clean_email($data['email'] ?? $data['user_email'] ?? '');
$userId = require_user_id($conn, $email);
ensure_diary_share_tables($conn);

$stmt = $conn->prepare(
    'SELECT u.id, u.username, u.full_name, u.email, b.created_at
     FROM diary_user_blocks b
     JOIN diaryusers u ON u.id = b.blocked_user_id
     WHERE b.blocker_user_id = ?
     ORDER BY b.created_at DESC'
);
$stmt->bind_param('i', $userId);
$stmt->execute();
$users = $stmt->get_result()->fetch_all(MYSQLI_ASSOC) ?: [];

json_response(['status' => 'success', 'users' => $users]);
?>
