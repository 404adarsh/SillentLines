<?php
require_once __DIR__ . '/api_helpers.php';

$data = input_json();
$email = clean_email($data['email'] ?? $data['user_email'] ?? $data['owner_email'] ?? '');
$entryId = (int) ($data['entry_id'] ?? $data['id'] ?? 0);

if ($entryId <= 0) {
    json_response(['status' => 'error', 'message' => 'Entry id is required'], 400);
}

$userId = require_user_id($conn, $email);
$profile = user_profile($conn, $email);
$ownerId = (int) ($profile['id'] ?? $userId);

$table = diary_table($conn);
ensure_diary_metadata_columns($conn, $table);
$textColumn = column_exists($conn, $table, 'entry_text') ? 'entry_text' : 'entry';
$emotionExpr = column_exists($conn, $table, 'emotion') ? 'd.emotion' : (column_exists($conn, $table, 'mood') ? 'd.mood' : "''");
$createdExpr = column_exists($conn, $table, 'created_at') ? 'd.created_at' : 'NOW()';
$ivExpr = column_exists($conn, $table, 'entry_iv') ? 'd.entry_iv' : "''";
$titleExpr = column_exists($conn, $table, 'diary_title') ? 'd.diary_title' : "''";
$diaryDateExpr = column_exists($conn, $table, 'diary_date') ? 'd.diary_date' : 'DATE(' . $createdExpr . ')';

$ownerEmailExpr = "''";
if (column_exists($conn, $table, 'user_email')) {
    $ownerEmailExpr = 'd.user_email';
} elseif (column_exists($conn, $table, 'owner_email')) {
    $ownerEmailExpr = 'd.owner_email';
} elseif (column_exists($conn, $table, 'email')) {
    $ownerEmailExpr = 'd.email';
}

$hasTrades = table_exists($conn, 'trades');
$tradeJoinSql = $hasTrades ? 'LEFT JOIN trades t ON t.diary_entry_id = d.id AND t.user_id = ?' : '';
$tradeSelectSql = $hasTrades
    ? 't.asset, t.trade_type, t.buy_price AS entry_price, t.sell_price AS exit_price'
    : "'' AS asset, '' AS trade_type, NULL AS entry_price, NULL AS exit_price";

$ownerFilters = [];
$types = 'i';
$values = [$entryId];

if (column_exists($conn, $table, 'user_id')) {
    $ownerFilters[] = 'd.user_id = ?';
    $types .= 'i';
    $values[] = $userId;
}
if (column_exists($conn, $table, 'owner_id')) {
    $ownerFilters[] = 'd.owner_id = ?';
    $types .= 'i';
    $values[] = $ownerId;
}
if (column_exists($conn, $table, 'user_email')) {
    $ownerFilters[] = 'LOWER(d.user_email) = LOWER(?)';
    $types .= 's';
    $values[] = $email;
}
if (column_exists($conn, $table, 'owner_email')) {
    $ownerFilters[] = 'LOWER(d.owner_email) = LOWER(?)';
    $types .= 's';
    $values[] = $email;
}
if (column_exists($conn, $table, 'email')) {
    $ownerFilters[] = 'LOWER(d.email) = LOWER(?)';
    $types .= 's';
    $values[] = $email;
}

if (!$ownerFilters) {
    json_response(['status' => 'error', 'message' => 'Diary table has no supported owner column'], 500);
}

$accessWhere = '(' . implode(' OR ', $ownerFilters) . ')';
$joinCollaborators = table_exists($conn, 'diary_collaborators') && table_exists($conn, 'diaryusers');
if ($joinCollaborators) {
    $accessWhere = '(' . $accessWhere . ' OR (c.user_id = ? AND c.status = ?))';
    $types .= 'is';
    $values[] = $userId;
    $values[] = 'accepted';
}

$collabJoinSql = $joinCollaborators
    ? ' LEFT JOIN diary_collaborators c ON c.entry_id = d.id '
    : '';

$sql = "SELECT DISTINCT d.id, d.$textColumn AS entry_text, $ivExpr AS entry_iv,
               $emotionExpr AS emotion, $createdExpr AS created_at,
               $titleExpr AS diary_title, $diaryDateExpr AS diary_date,
               $ownerEmailExpr AS owner_email,
               $tradeSelectSql
        FROM $table d
        $collabJoinSql
        $tradeJoinSql
        WHERE d.id = ? AND $accessWhere
        LIMIT 1";

if ($hasTrades) {
    $types = 'i' . $types;
    array_unshift($values, $userId);
}

$stmt = $conn->prepare($sql);
if (!$stmt) {
    json_response(['status' => 'error', 'message' => 'Query prepare failed: ' . $conn->error], 500);
}

bind_dynamic($stmt, $types, $values);

if (!$stmt->execute()) {
    json_response(['status' => 'error', 'message' => 'Query execute failed: ' . $stmt->error], 500);
}

$entry = $stmt->get_result()->fetch_assoc();

if (!$entry) {
    json_response(['status' => 'error', 'message' => 'Entry not found or you cannot access this note'], 404);
}

if (!empty($entry['entry_iv']) && function_exists('decryptDiaryEntry')) {
    $decrypted = decryptDiaryEntry((string) $entry['entry_text'], (string) $entry['entry_iv']);
    $entry['entry_text'] = $decrypted === false ? '' : $decrypted;
}

$entry['owner_is_current_user'] = strtolower((string) ($entry['owner_email'] ?? '')) === strtolower($email);
unset($entry['entry_iv']);

json_response(['status' => 'success', 'entry' => $entry]);
?>
