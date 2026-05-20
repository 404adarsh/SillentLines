<?php
require_once __DIR__ . '/api_helpers.php';

$data = input_json();
$entryId = max(0, (int) ($data['entry_id'] ?? 0));
$currentEmail = trim((string) ($data['current_email'] ?? ''));
$pageIndex = max(0, (int) ($data['page'] ?? 0));
$cursor = trim((string) ($data['cursor'] ?? ''));
$cursor = mb_substr($cursor, 0, 120);

if ($entryId <= 0) {
    json_response(['status' => 'error', 'message' => 'Valid entry ID is required'], 400);
}

ensure_diary_share_tables($conn);
$table = diary_table($conn);

$currentUserId = 0;
$currentUserProfile = null;
$currentRole = 'reader';
if ($currentEmail !== '' && filter_var($currentEmail, FILTER_VALIDATE_EMAIL)) {
    $lookupStmt = $conn->prepare('SELECT id, email, username, full_name FROM diaryusers WHERE LOWER(email) = LOWER(?) LIMIT 1');
    if ($lookupStmt) {
        $lookupStmt->bind_param('s', $currentEmail);
        $lookupStmt->execute();
        $currentUserProfile = $lookupStmt->get_result()->fetch_assoc();
        if ($currentUserProfile) {
            $currentUserId = (int) $currentUserProfile['id'];
            if (user_owns_entry($conn, $table, $entryId, $currentUserId, $currentEmail)) {
                $currentRole = 'owner';
            } elseif (user_can_read_entry($conn, $table, $entryId, $currentUserId, $currentEmail)) {
                $currentRole = 'collaborator';
            }
        }
    }
}

$token = "entry-presence-{$entryId}";
if ($currentUserId > 0 && in_array($currentRole, ['owner', 'collaborator'], true)) {
    $insertStmt = $conn->prepare(
        "INSERT INTO diary_share_presence
            (token, entry_id, user_id, user_email, username, full_name, role, page_index, cursor_hint, last_seen)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
            user_email = VALUES(user_email),
            username = VALUES(username),
            full_name = VALUES(full_name),
            role = VALUES(role),
            page_index = VALUES(page_index),
            cursor_hint = VALUES(cursor_hint),
            last_seen = NOW()"
    );
    if ($insertStmt) {
        $userEmail = (string) ($currentUserProfile['email'] ?? $currentEmail);
        $username = (string) ($currentUserProfile['username'] ?? '');
        $fullName = (string) ($currentUserProfile['full_name'] ?? '');
        $insertStmt->bind_param('siissssis', $token, $entryId, $currentUserId, $userEmail, $username, $fullName, $currentRole, $pageIndex, $cursor);
        $insertStmt->execute();
    }
}

$activeStmt = $conn->prepare(
    "SELECT user_id, user_email, username, full_name, role, page_index, cursor_hint
     FROM diary_share_presence
     WHERE token = ?
       AND last_seen >= DATE_SUB(NOW(), INTERVAL 30 SECOND)
     ORDER BY FIELD(role, 'owner', 'collaborator') DESC, full_name ASC"
);
if (!$activeStmt) {
    json_response(['status' => 'error', 'message' => 'Could not prepare presence query'], 500);
}
$activeStmt->bind_param('s', $token);
$activeStmt->execute();
$activeUsers = $activeStmt->get_result()->fetch_all(MYSQLI_ASSOC) ?: [];

json_response(['status' => 'success', 'active_users' => $activeUsers]);
