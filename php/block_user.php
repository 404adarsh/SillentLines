<?php
require_once __DIR__ . '/api_helpers.php';

$data = input_json();
$email = clean_email($data['email'] ?? $data['user_email'] ?? '');
$action = strtolower(trim((string) ($data['action'] ?? 'block')));
$username = ltrim(trim((string) ($data['username'] ?? $data['identifier'] ?? '')), '@');
$blockedId = (int) ($data['blocked_user_id'] ?? 0);

if (!in_array($action, ['block', 'unblock'], true)) {
    json_response(['status' => 'error', 'message' => 'Valid block action is required'], 400);
}

$userId = require_user_id($conn, $email);
ensure_diary_share_tables($conn);

if ($blockedId <= 0) {
    if ($username === '') {
        json_response(['status' => 'error', 'message' => 'Username is required'], 400);
    }
    $find = $conn->prepare('SELECT id, email, username, full_name FROM diaryusers WHERE LOWER(username) = LOWER(?) LIMIT 1');
    $find->bind_param('s', $username);
} else {
    $find = $conn->prepare('SELECT id, email, username, full_name FROM diaryusers WHERE id = ? LIMIT 1');
    $find->bind_param('i', $blockedId);
}
$find->execute();
$target = $find->get_result()->fetch_assoc();

if (!$target) {
    json_response(['status' => 'error', 'message' => 'No registered user found with that username'], 404);
}

$targetId = (int) $target['id'];
if ($targetId === $userId) {
    json_response(['status' => 'error', 'message' => 'You cannot block yourself'], 400);
}

if ($action === 'block') {
    $stmt = $conn->prepare('INSERT IGNORE INTO diary_user_blocks (blocker_user_id, blocked_user_id, created_at) VALUES (?, ?, NOW())');
    $stmt->bind_param('ii', $userId, $targetId);
    if (!$stmt->execute()) {
        json_response(['status' => 'error', 'message' => 'Could not block this user'], 500);
    }

    $deletePending = $conn->prepare(
        "DELETE FROM diary_collaborators
         WHERE (owner_id = ? AND user_id = ?) OR (owner_id = ? AND user_id = ?)"
    );
    $deletePending->bind_param('iiii', $userId, $targetId, $targetId, $userId);
    $deletePending->execute();

    $targetEmail = (string) $target['email'];
    $deleteNotifs = $conn->prepare(
        'DELETE FROM diary_notifications
         WHERE (LOWER(recipient_email) = LOWER(?) AND sender_id = ?)
            OR (LOWER(recipient_email) = LOWER(?) AND sender_id = ?)'
    );
    $deleteNotifs->bind_param('sisi', $email, $targetId, $targetEmail, $userId);
    $deleteNotifs->execute();
} else {
    $stmt = $conn->prepare('DELETE FROM diary_user_blocks WHERE blocker_user_id = ? AND blocked_user_id = ?');
    $stmt->bind_param('ii', $userId, $targetId);
    if (!$stmt->execute()) {
        json_response(['status' => 'error', 'message' => 'Could not unblock this user'], 500);
    }
}

json_response([
    'status' => 'success',
    'message' => $action === 'block' ? 'User blocked.' : 'User unblocked.',
    'user' => [
        'id' => $targetId,
        'username' => $target['username'] ?? '',
        'full_name' => $target['full_name'] ?? '',
        'email' => $target['email'] ?? '',
    ],
]);
?>
