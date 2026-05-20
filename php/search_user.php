<?php
require_once __DIR__ . '/api_helpers.php';

$data = input_json();
$query = trim((string) ($data['query'] ?? $data['username'] ?? $data['email'] ?? ''));
$email = trim((string) ($data['email'] ?? $data['user_email'] ?? ''));
if (strlen($query) < 2) {
    json_response(['status' => 'success', 'users' => []]);
}

$like = '%' . $query . '%';
if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $userId = require_user_id($conn, $email);
    ensure_diary_share_tables($conn);
    $stmt = $conn->prepare(
        'SELECT u.id, u.email, u.username, u.full_name
         FROM diaryusers u
         LEFT JOIN diary_user_blocks outgoing ON outgoing.blocker_user_id = ? AND outgoing.blocked_user_id = u.id
         LEFT JOIN diary_user_blocks incoming ON incoming.blocker_user_id = u.id AND incoming.blocked_user_id = ?
         WHERE (u.username LIKE ? OR u.email LIKE ? OR u.full_name LIKE ?)
           AND u.id <> ?
           AND outgoing.id IS NULL
           AND incoming.id IS NULL
         ORDER BY u.username ASC
         LIMIT 12'
    );
    $stmt->bind_param('iisssi', $userId, $userId, $like, $like, $like, $userId);
} else {
    $stmt = $conn->prepare(
        'SELECT id, email, username, full_name
         FROM diaryusers
         WHERE username LIKE ? OR email LIKE ? OR full_name LIKE ?
         ORDER BY username ASC
         LIMIT 12'
    );
    $stmt->bind_param('sss', $like, $like, $like);
}
$stmt->execute();
$users = $stmt->get_result()->fetch_all(MYSQLI_ASSOC) ?: [];

json_response(['status' => 'success', 'users' => $users]);
?>
