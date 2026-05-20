<?php
require_once __DIR__ . '/api_helpers.php';

$data = input_json();
$token = trim((string) ($data['token'] ?? ''));
if (!preg_match('/^[a-f0-9]{32,80}$/i', $token)) {
    json_response(['status' => 'error', 'message' => 'Valid share token is required'], 400);
}

$pageIndex = max(0, (int) ($data['page'] ?? 0));
$cursor = trim((string) ($data['cursor'] ?? ''));
$currentEmail = trim((string) ($data['current_email'] ?? ''));

ensure_diary_share_tables($conn);
$table = diary_table($conn);

$stmt = $conn->prepare('SELECT entry_id FROM diary_public_shares WHERE token = ? AND revoked_at IS NULL LIMIT 1');
if (!$stmt) {
    json_response(['status' => 'error', 'message' => 'Could not prepare share lookup'], 500);
}
$stmt->bind_param('s', $token);
$stmt->execute();
$shareRow = $stmt->get_result()->fetch_assoc();
if (!$shareRow) {
    json_response(['status' => 'error', 'message' => 'Shared page was not found'], 404);
}
$entryId = (int) $shareRow['entry_id'];

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
