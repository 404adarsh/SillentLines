<?php
require_once __DIR__ . '/api_helpers.php';

$data = input_json();
$token = trim((string) ($data['token'] ?? ''));
if (!preg_match('/^[a-f0-9]{32,80}$/i', $token)) {
    json_response(['status' => 'error', 'message' => 'Valid share token is required'], 400);
}

ensure_diary_share_tables($conn);
$table = diary_table($conn);
ensure_diary_metadata_columns($conn, $table);

// Public share links intentionally grant read access by unrevoked random token.
// Keep export/collaborator metadata behind the authenticated ownership checks below.
$textColumn = column_exists($conn, $table, 'entry_text') ? 'entry_text' : 'entry';
$emotionExpr = column_exists($conn, $table, 'emotion') ? 'd.emotion' : (column_exists($conn, $table, 'mood') ? 'd.mood' : "''");
$createdExpr = column_exists($conn, $table, 'created_at') ? 'd.created_at' : 'NOW()';
$ivExpr = column_exists($conn, $table, 'entry_iv') ? 'd.entry_iv' : "''";
$titleExpr = column_exists($conn, $table, 'diary_title') ? 'd.diary_title' : "''";
$diaryDateExpr = column_exists($conn, $table, 'diary_date') ? 'd.diary_date' : 'DATE(' . $createdExpr . ')';
$ownerNameExpr = column_exists($conn, $table, 'user_full_name') ? 'd.user_full_name' : "''";

$sql = "SELECT d.id, d.$textColumn AS entry_text, $ivExpr AS entry_iv,
               $emotionExpr AS emotion, $createdExpr AS created_at,
               $titleExpr AS diary_title, $diaryDateExpr AS diary_date,
               $ownerNameExpr AS owner_full_name,
               s.entry_id AS shared_entry_id, s.created_by_user_id AS shared_created_by_user_id,
               s.theme_json
        FROM diary_public_shares s
        JOIN $table d ON d.id = s.entry_id
        WHERE s.token = ? AND s.revoked_at IS NULL
        LIMIT 1";
$stmt = $conn->prepare($sql);
if (!$stmt) {
    json_response(['status' => 'error', 'message' => 'Query prepare failed: ' . $conn->error], 500);
}
$stmt->bind_param('s', $token);
$stmt->execute();
$entry = $stmt->get_result()->fetch_assoc();
if (!$entry) {
    json_response(['status' => 'error', 'message' => 'Shared entry was not found'], 404);
}

if (!empty($entry['entry_iv']) && function_exists('decryptDiaryEntry')) {
    $decrypted = decryptDiaryEntry((string) $entry['entry_text'], (string) $entry['entry_iv']);
    $entry['entry_text'] = $decrypted === false ? '' : $decrypted;
}
unset($entry['entry_iv']);

$currentEmail = trim((string) ($data['current_email'] ?? ''));
$entry['entry_id'] = (int) ($entry['shared_entry_id'] ?? 0);
$entry['can_export'] = false;
$entry['is_owner'] = false;
$entry['is_collaborator'] = false;
$entry['collaborators'] = [];

if ($currentEmail !== '' && filter_var($currentEmail, FILTER_VALIDATE_EMAIL)) {
    $lookupStmt = $conn->prepare('SELECT id, email, username, full_name FROM diaryusers WHERE LOWER(email) = LOWER(?) LIMIT 1');
    if ($lookupStmt) {
        $lookupStmt->bind_param('s', $currentEmail);
        $lookupStmt->execute();
        $userRow = $lookupStmt->get_result()->fetch_assoc();
        if ($userRow) {
            $currentUserId = (int) $userRow['id'];
            $entry['is_owner'] = user_owns_entry($conn, $table, $entry['shared_entry_id'], $currentUserId, $currentEmail);
            $entry['is_collaborator'] = !$entry['is_owner'] && user_can_read_entry($conn, $table, $entry['shared_entry_id'], $currentUserId, $currentEmail);
            $entry['can_export'] = $entry['is_owner'] || $entry['is_collaborator'];
        }
    }
}

if ($entry['can_export']) {
    $collabStmt = $conn->prepare(
        "SELECT u.id, u.email, u.username, u.full_name
         FROM diary_collaborators c
         INNER JOIN diaryusers u ON u.id = c.user_id
         WHERE c.entry_id = ? AND c.status IN ('accepted', 'active', 'approved')"
    );
    if ($collabStmt) {
        $collabStmt->bind_param('i', $entry['shared_entry_id']);
        $collabStmt->execute();
        $entry['collaborators'] = $collabStmt->get_result()->fetch_all(MYSQLI_ASSOC) ?: [];
    }
}

$theme = json_decode((string) ($entry['theme_json'] ?? ''), true);
$entry['theme'] = is_array($theme) ? $theme : null;
unset($entry['theme_json']);

json_response(['status' => 'success', 'entry' => $entry]);
?>
