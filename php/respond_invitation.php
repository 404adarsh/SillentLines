<?php
require_once __DIR__ . '/api_helpers.php';

$data = input_json();
$entryId = (int) ($data['entry_id'] ?? 0);
$email = clean_email($data['user_email'] ?? $data['email'] ?? '');
$action = strtolower(trim($data['action'] ?? ''));

if ($entryId <= 0 || !in_array($action, ['accept', 'reject'], true)) {
    json_response(['status' => 'error', 'message' => 'Entry id and a valid action are required'], 400);
}

$userId = require_user_id($conn, $email);
ensure_diary_share_tables($conn);
ensure_entry_collab_history_table($conn);

$check = $conn->prepare('SELECT id, status, owner_id FROM diary_collaborators WHERE entry_id = ? AND user_id = ? LIMIT 1');
$check->bind_param('ii', $entryId, $userId);
$check->execute();
$invite = $check->get_result()->fetch_assoc();

if (!$invite) {
    json_response(['status' => 'error', 'message' => 'Invitation was not found for this account'], 404);
}

if ($action === 'accept' && !empty($invite['owner_id']) && diary_users_blocked_between($conn, (int) $invite['owner_id'], $userId)) {
    json_response(['status' => 'error', 'message' => 'This invitation cannot be accepted because one of you has blocked the other user.'], 403);
}

if ($action === 'accept') {
    $update = $conn->prepare("UPDATE diary_collaborators SET status = 'accepted', accepted_at = COALESCE(accepted_at, NOW()), updated_at = NOW() WHERE entry_id = ? AND user_id = ?");
    $update->bind_param('ii', $entryId, $userId);
    if (!$update->execute()) {
        json_response(['status' => 'error', 'message' => 'Could not accept invitation'], 500);
    }
    log_entry_collab_event($conn, $entryId, $userId, 'accepted collaborator', $userId);
} else {
    $reject = $conn->prepare("UPDATE diary_collaborators SET status = 'rejected', updated_at = NOW() WHERE entry_id = ? AND user_id = ?");
    $reject->bind_param('ii', $entryId, $userId);
    if (!$reject->execute()) {
        json_response(['status' => 'error', 'message' => 'Could not reject invitation'], 500);
    }
}

$deleteNotif = $conn->prepare('DELETE FROM diary_notifications WHERE LOWER(recipient_email) = LOWER(?) AND entry_id = ?');
$deleteNotif->bind_param('si', $email, $entryId);
$deleteNotif->execute();

json_response([
    'status' => 'success',
    'message' => $action === 'accept' ? 'Invitation accepted.' : 'Invitation rejected.',
    'entry_id' => $entryId,
]);

function ensure_entry_collab_history_table(mysqli $conn): void {
    $conn->query(
        "CREATE TABLE IF NOT EXISTS diary_collaboration_history (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            entry_id INT NOT NULL,
            actor_user_id INT NOT NULL,
            target_user_id INT NOT NULL,
            action VARCHAR(60) NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_diary_collab_history_entry (entry_id, created_at),
            KEY idx_diary_collab_history_target (target_user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

function log_entry_collab_event(mysqli $conn, int $entryId, int $actorId, string $action, int $targetId): void {
    $stmt = $conn->prepare('INSERT INTO diary_collaboration_history (entry_id, actor_user_id, target_user_id, action) VALUES (?, ?, ?, ?)');
    $stmt->bind_param('iiis', $entryId, $actorId, $targetId, $action);
    $stmt->execute();
}
?>
