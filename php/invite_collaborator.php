<?php
require_once __DIR__ . '/api_helpers.php';

$data = input_json();
$data['action'] = 'invite';
$email = clean_email($data['owner_email'] ?? $data['email'] ?? $data['user_email'] ?? '');
$entryId = (int) ($data['entry_id'] ?? 0);
$friendId = (int) ($data['friend_id'] ?? 0);

if ($entryId <= 0 || $friendId <= 0) {
    json_response(['status' => 'error', 'message' => 'Entry id and user id are required'], 400);
}

$userId = require_user_id($conn, $email);
$profile = user_profile($conn, $email);
$table = diary_table($conn);
ensure_diary_share_tables($conn);

if (!user_owns_entry($conn, $table, $entryId, $userId, $email)) {
    json_response(['status' => 'error', 'message' => 'Only the owner can share this diary entry'], 403);
}

$find = $conn->prepare('SELECT id, email, username, full_name FROM diaryusers WHERE id = ? LIMIT 1');
$find->bind_param('i', $friendId);
$find->execute();
$target = $find->get_result()->fetch_assoc();

if (!$target) {
    json_response(['status' => 'error', 'message' => 'User was not found'], 404);
}

$targetId = (int) $target['id'];
$targetEmail = (string) $target['email'];
if ($targetId === $userId || strtolower($targetEmail) === strtolower($email)) {
    json_response(['status' => 'error', 'message' => 'You cannot invite yourself'], 400);
}
if (diary_users_blocked_between($conn, $userId, $targetId)) {
    json_response(['status' => 'error', 'message' => 'This share cannot be sent because one of you has blocked the other user.'], 403);
}

$senderUsername = (string) ($profile['username'] ?? $profile['full_name'] ?? 'Someone');
$senderName = (string) (($profile['full_name'] ?? '') ?: ($profile['username'] ?? 'Someone'));
$entryTitle = diary_share_entry_title($conn, $table, $entryId);

$existingInvite = $conn->prepare('SELECT status, email_sent_at FROM diary_collaborators WHERE entry_id = ? AND user_id = ? LIMIT 1');
$existingInvite->bind_param('ii', $entryId, $targetId);
$existingInvite->execute();
$inviteRow = $existingInvite->get_result()->fetch_assoc();
if ($inviteRow && ($inviteRow['status'] ?? '') === 'pending') {
    $notificationReady = ensure_diary_share_notification($conn, $targetEmail, $userId, $senderUsername, $entryId);
    $emailSent = false;
    if (empty($inviteRow['email_sent_at']) && diary_notification_email_allowed($conn, $targetId, $targetEmail, $userId, $entryId)) {
        $emailSent = send_diary_share_email($targetEmail, $senderName, $entryTitle);
        if ($emailSent) {
            $markEmail = $conn->prepare('UPDATE diary_collaborators SET email_sent_at = NOW(), notified_at = NOW(), updated_at = NOW() WHERE entry_id = ? AND user_id = ?');
            $markEmail->bind_param('ii', $entryId, $targetId);
            $markEmail->execute();
        }
    }
    json_response([
        'status' => 'success',
        'message' => $emailSent
            ? 'Invite was already pending, so I restored the notification and sent the missing email.'
            : ($notificationReady
                ? 'Invite is already pending. I restored the notification without sending a duplicate email.'
                : 'Invite is already pending, but the notification could not be restored.'),
        'duplicate' => true,
        'email_sent' => $emailSent,
    ]);
}
if ($inviteRow && ($inviteRow['status'] ?? '') === 'accepted') {
    json_response(['status' => 'success', 'message' => 'This user already has access to the diary entry.', 'duplicate' => true]);
}

$collab = $conn->prepare(
    "INSERT INTO diary_collaborators (entry_id, user_id, owner_id, status, created_at, updated_at, notified_at)
     VALUES (?, ?, ?, 'pending', NOW(), NOW(), NOW())
     ON DUPLICATE KEY UPDATE status = IF(status = 'accepted', status, 'pending'), owner_id = VALUES(owner_id), notified_at = NOW(), updated_at = NOW()"
);
$collab->bind_param('iii', $entryId, $targetId, $userId);
if (!$collab->execute()) {
    json_response(['status' => 'error', 'message' => 'Could not invite this user'], 500);
}

$notificationReady = ensure_diary_share_notification($conn, $targetEmail, $userId, $senderUsername, $entryId);
$emailAllowed = diary_notification_email_allowed($conn, $targetId, $targetEmail, $userId, $entryId);
$emailSent = $emailAllowed ? send_diary_share_email($targetEmail, $senderName, $entryTitle) : false;
if ($emailSent) {
    $markEmail = $conn->prepare('UPDATE diary_collaborators SET email_sent_at = NOW() WHERE entry_id = ? AND user_id = ?');
    $markEmail->bind_param('ii', $entryId, $targetId);
    $markEmail->execute();
}

json_response([
    'status' => 'success',
    'message' => $emailSent
        ? 'Invite sent successfully! They will see it in notifications and email.'
        : (!$emailAllowed
            ? 'Invite sent successfully! They will see it in notifications, but their email preferences block diary emails.'
            : ($notificationReady
            ? 'Invite sent successfully! They will see it in notifications. Email could not be sent by the server.'
            : 'Invite saved, but notification and email could not be sent by the server.')),
    'email_sent' => $emailSent,
]);
?>
