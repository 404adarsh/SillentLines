<?php
require_once __DIR__ . '/api_helpers.php';

$data = input_json();
$email = clean_email($data['email'] ?? $data['user_email'] ?? $data['owner_email'] ?? '');
$entryId = (int) ($data['entry_id'] ?? 0);
$action = strtolower(trim((string) ($data['action'] ?? 'list')));

if ($entryId <= 0) {
    json_response(['status' => 'error', 'message' => 'Entry id is required'], 400);
}

$userId = require_user_id($conn, $email);
$profile = user_profile($conn, $email);
$table = diary_table($conn);
ensure_diary_share_tables($conn);
ensure_entry_collab_history_table($conn);

if (!user_can_read_entry($conn, $table, $entryId, $userId, $email)) {
    json_response(['status' => 'error', 'message' => 'You cannot access this diary entry'], 403);
}

if ($action === 'transfer') {
    if (!user_owns_entry($conn, $table, $entryId, $userId, $email)) {
        json_response(['status' => 'error', 'message' => 'Only the owner can transfer this diary entry'], 403);
    }
    $newOwnerId = (int) ($data['new_owner_id'] ?? 0);
    if ($newOwnerId <= 0 || $newOwnerId === $userId) {
        json_response(['status' => 'error', 'message' => 'Choose another accepted collaborator'], 400);
    }
    $accepted = $conn->prepare("SELECT id FROM diary_collaborators WHERE entry_id = ? AND user_id = ? AND status = 'accepted' LIMIT 1");
    $accepted->bind_param('ii', $entryId, $newOwnerId);
    $accepted->execute();
    if (!$accepted->get_result()->fetch_assoc()) {
        json_response(['status' => 'error', 'message' => 'Ownership can be transferred only to an accepted collaborator'], 400);
    }
    $newOwner = lookup_entry_collab_user($conn, $newOwnerId);
    if (!$newOwner) {
        json_response(['status' => 'error', 'message' => 'New owner was not found'], 404);
    }

    try {
        $conn->begin_transaction();
        transfer_entry_owner($conn, $table, $entryId, $profile, $newOwner);

        $oldOwnerId = (int) ($profile['id'] ?? $userId);
        $upsertOld = $conn->prepare(
            "INSERT INTO diary_collaborators (entry_id, user_id, owner_id, status, created_at, updated_at, accepted_at, notified_at)
             VALUES (?, ?, ?, 'accepted', NOW(), NOW(), NOW(), NOW())
             ON DUPLICATE KEY UPDATE owner_id = VALUES(owner_id), status = 'accepted', accepted_at = COALESCE(accepted_at, NOW()), updated_at = NOW()"
        );
        $upsertOld->bind_param('iii', $entryId, $oldOwnerId, $newOwnerId);
        $upsertOld->execute();

        $deleteNewOwnerCollab = $conn->prepare('DELETE FROM diary_collaborators WHERE entry_id = ? AND user_id = ?');
        $deleteNewOwnerCollab->bind_param('ii', $entryId, $newOwnerId);
        $deleteNewOwnerCollab->execute();

        $updateOwner = $conn->prepare('UPDATE diary_collaborators SET owner_id = ?, updated_at = NOW() WHERE entry_id = ?');
        $updateOwner->bind_param('ii', $newOwnerId, $entryId);
        $updateOwner->execute();

        log_entry_collab_event($conn, $entryId, $oldOwnerId, 'ownership_transferred', $newOwnerId);
        $conn->commit();
    } catch (Throwable $e) {
        try { $conn->rollback(); } catch (Throwable $ignored) {}
        error_log('Entry ownership transfer failed: ' . $e->getMessage());
        json_response(['status' => 'error', 'message' => 'Could not transfer ownership right now'], 500);
    }
}

json_response(entry_collaborator_payload($conn, $table, $entryId, $userId, $email, $profile));

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

function lookup_entry_collab_user(mysqli $conn, int $userId): ?array {
    $stmt = $conn->prepare('SELECT id, email, username, full_name FROM diaryusers WHERE id = ? LIMIT 1');
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    return $row ?: null;
}

function transfer_entry_owner(mysqli $conn, string $table, int $entryId, array $oldOwner, array $newOwner): void {
    $sets = [];
    $types = '';
    $values = [];
    $newOwnerId = (int) ($newOwner['id'] ?? 0);
    foreach (['user_id', 'owner_id'] as $column) {
        if (column_exists($conn, $table, $column)) {
            $sets[] = "$column = ?";
            $types .= 'i';
            $values[] = $newOwnerId;
        }
    }
    foreach (['email', 'user_email', 'owner_email'] as $column) {
        if (column_exists($conn, $table, $column)) {
            $sets[] = "$column = ?";
            $types .= 's';
            $values[] = (string) ($newOwner['email'] ?? '');
        }
    }
    if (column_exists($conn, $table, 'user_username')) {
        $sets[] = 'user_username = ?';
        $types .= 's';
        $values[] = (string) ($newOwner['username'] ?? '');
    }
    if (column_exists($conn, $table, 'user_full_name')) {
        $sets[] = 'user_full_name = ?';
        $types .= 's';
        $values[] = (string) ($newOwner['full_name'] ?? '');
    }
    if (!$sets) {
        throw new RuntimeException('Diary table has no transferable owner columns.');
    }
    $values[] = $entryId;
    $types .= 'i';
    $stmt = $conn->prepare("UPDATE $table SET " . implode(', ', $sets) . ' WHERE id = ?');
    bind_dynamic($stmt, $types, $values);
    if (!$stmt->execute()) {
        throw new RuntimeException($stmt->error ?: 'Owner update failed.');
    }
}

function log_entry_collab_event(mysqli $conn, int $entryId, int $actorId, string $action, int $targetId): void {
    $stmt = $conn->prepare('INSERT INTO diary_collaboration_history (entry_id, actor_user_id, target_user_id, action) VALUES (?, ?, ?, ?)');
    $stmt->bind_param('iiis', $entryId, $actorId, $targetId, $action);
    $stmt->execute();
}

function entry_collaborator_payload(mysqli $conn, string $table, int $entryId, int $currentUserId, string $email, array $currentProfile): array {
    $owner = entry_owner_profile($conn, $table, $entryId);
    $isOwner = user_owns_entry($conn, $table, $entryId, $currentUserId, $email);
    if ($isOwner && empty($owner['email']) && empty($owner['username']) && empty($owner['full_name'])) {
        $owner = [
            'id' => (int) ($currentProfile['id'] ?? $currentUserId),
            'email' => (string) ($currentProfile['email'] ?? $email),
            'username' => (string) ($currentProfile['username'] ?? ''),
            'full_name' => (string) ($currentProfile['full_name'] ?? ''),
        ];
    }

    $stmt = $conn->prepare(
        "SELECT c.user_id AS id, c.status, c.created_at, c.updated_at, c.accepted_at, u.email, u.username, u.full_name
         FROM diary_collaborators c
         INNER JOIN diaryusers u ON u.id = c.user_id
         WHERE c.entry_id = ?
         ORDER BY CASE c.status WHEN 'accepted' THEN 1 WHEN 'pending' THEN 2 WHEN 'rejected' THEN 3 ELSE 4 END, c.updated_at DESC"
    );
    if (!$stmt) {
        json_response(['status' => 'error', 'message' => 'Could not prepare collaborator list: ' . $conn->error], 500);
    }
    $stmt->bind_param('i', $entryId);
    $stmt->execute();
    $collaborators = $stmt->get_result()->fetch_all(MYSQLI_ASSOC) ?: [];

    $history = [];

    $histStmt = $conn->prepare(
        'SELECT h.action, h.created_at, a.username AS actor_username, a.full_name AS actor_full_name,
                t.id, t.email, t.username, t.full_name
         FROM diary_collaboration_history h
         LEFT JOIN diaryusers a ON a.id = h.actor_user_id
         LEFT JOIN diaryusers t ON t.id = h.target_user_id
         WHERE h.entry_id = ?
         ORDER BY h.created_at DESC
         LIMIT 80'
    );
    $histStmt->bind_param('i', $entryId);
    $histStmt->execute();
    foreach ($histStmt->get_result()->fetch_all(MYSQLI_ASSOC) as $row) {
        $history[] = [
            'action' => $row['action'],
            'created_at' => $row['created_at'],
            'actor' => ['username' => $row['actor_username'] ?? '', 'full_name' => $row['actor_full_name'] ?? ''],
            'user' => ['id' => $row['id'], 'email' => $row['email'], 'username' => $row['username'], 'full_name' => $row['full_name']],
        ];
    }

    return [
        'status' => 'success',
        'entry_id' => $entryId,
        'is_owner' => $isOwner,
        'owner' => $owner,
        'collaborators' => $collaborators,
        'history' => $history,
    ];
}

function entry_owner_profile(mysqli $conn, string $table, int $entryId): array {
    $selects = [];
    foreach (['user_id', 'owner_id', 'email', 'user_email', 'owner_email', 'user_username', 'user_full_name'] as $column) {
        if (column_exists($conn, $table, $column)) {
            $selects[] = $column;
        }
    }
    $entry = [];
    if ($selects) {
        $stmt = $conn->prepare('SELECT ' . implode(', ', $selects) . " FROM $table WHERE id = ? LIMIT 1");
        $stmt->bind_param('i', $entryId);
        $stmt->execute();
        $entry = $stmt->get_result()->fetch_assoc() ?: [];
    }
    $ownerId = (int) ($entry['owner_id'] ?? $entry['user_id'] ?? 0);
    if ($ownerId > 0) {
        return lookup_entry_collab_user($conn, $ownerId) ?: [];
    }
    if (table_exists($conn, 'diary_collaborators')) {
        $collabOwner = $conn->prepare('SELECT owner_id FROM diary_collaborators WHERE entry_id = ? AND owner_id > 0 ORDER BY updated_at DESC, id DESC LIMIT 1');
        if ($collabOwner) {
            $collabOwner->bind_param('i', $entryId);
            $collabOwner->execute();
            $ownerId = (int) ($collabOwner->get_result()->fetch_assoc()['owner_id'] ?? 0);
            if ($ownerId > 0) {
                return lookup_entry_collab_user($conn, $ownerId) ?: [];
            }
        }
    }
    foreach (['owner_email', 'user_email', 'email'] as $column) {
        $ownerEmail = (string) ($entry[$column] ?? '');
        if ($ownerEmail !== '') {
            $find = $conn->prepare('SELECT id, email, username, full_name FROM diaryusers WHERE LOWER(email) = LOWER(?) LIMIT 1');
            $find->bind_param('s', $ownerEmail);
            $find->execute();
            return $find->get_result()->fetch_assoc() ?: [
                'id' => 0,
                'email' => $ownerEmail,
                'username' => (string) ($entry['user_username'] ?? ''),
                'full_name' => (string) ($entry['user_full_name'] ?? ''),
            ];
        }
    }
    if (!empty($entry['user_username']) || !empty($entry['user_full_name'])) {
        return [
            'id' => $ownerId,
            'email' => '',
            'username' => (string) ($entry['user_username'] ?? ''),
            'full_name' => (string) ($entry['user_full_name'] ?? ''),
        ];
    }
    return [];
}
?>
