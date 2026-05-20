<?php
require_once __DIR__ . '/api_helpers.php';

$data = input_json();
$email = clean_email($data['email'] ?? '');
$entryId = (int) ($data['entry_id'] ?? 0);
$entryText = trim($data['entry'] ?? '');
$emotion = preg_replace('/[^a-z_ -]/i', '', $data['emotion'] ?? '');

if ($entryId <= 0 || $entryText === '') {
    json_response(['status' => 'error', 'message' => 'Entry id and text are required'], 400);
}

$userId = require_user_id($conn, $email);
$profile = user_profile($conn, $email);
$table = diary_table($conn);
ensure_diary_metadata_columns($conn, $table);
$textColumn = column_exists($conn, $table, 'entry_text') ? 'entry_text' : 'entry';
$emotionColumn = column_exists($conn, $table, 'emotion') ? 'emotion' : (column_exists($conn, $table, 'mood') ? 'mood' : '');
$hasCollaborators = table_exists($conn, 'diary_collaborators');
$diaryTitle = trim((string) ($data['diary_title'] ?? $data['title'] ?? ''));
$diaryTitle = substr($diaryTitle, 0, 180);
$diaryDate = trim((string) ($data['diary_date'] ?? ''));
if ($diaryDate !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $diaryDate)) {
    $diaryDate = '';
}

$ivExpr = column_exists($conn, $table, 'entry_iv') ? 'd.entry_iv' : "''";
$titleExpr = column_exists($conn, $table, 'diary_title') ? 'd.diary_title' : "''";
$diaryDateExpr = column_exists($conn, $table, 'diary_date') ? 'd.diary_date' : "''";
$emotionExpr = $emotionColumn !== '' ? "d.$emotionColumn" : "''";

$accessSql = "SELECT d.id, d.$textColumn AS current_text, $ivExpr AS entry_iv, $titleExpr AS current_title, $diaryDateExpr AS current_diary_date, $emotionExpr AS current_emotion FROM $table d";
$accessTypes = '';
$accessValues = [];
if ($hasCollaborators) {
    $accessSql .= " LEFT JOIN diary_collaborators c ON c.entry_id = d.id AND c.user_id = ? AND c.status = 'accepted'";
    $accessTypes .= 'i';
    $accessValues[] = $userId;
}
$accessSql .= ' WHERE d.id = ? AND (';
$accessTypes .= 'i';
$accessValues[] = $entryId;
$accessFilters = [];
if (column_exists($conn, $table, 'user_id')) {
    $accessFilters[] = 'd.user_id = ?';
    $accessTypes .= 'i';
    $accessValues[] = $userId;
}
if (column_exists($conn, $table, 'owner_id')) {
    $accessFilters[] = 'd.owner_id = ?';
    $accessTypes .= 'i';
    $accessValues[] = $userId;
}
if (column_exists($conn, $table, 'user_email')) {
    $accessFilters[] = 'LOWER(d.user_email) = LOWER(?)';
    $accessTypes .= 's';
    $accessValues[] = $email;
}
if (column_exists($conn, $table, 'owner_email')) {
    $accessFilters[] = 'LOWER(d.owner_email) = LOWER(?)';
    $accessTypes .= 's';
    $accessValues[] = $email;
}
if (column_exists($conn, $table, 'email')) {
    $accessFilters[] = 'LOWER(d.email) = LOWER(?)';
    $accessTypes .= 's';
    $accessValues[] = $email;
}
if ($hasCollaborators) {
    $accessFilters[] = 'c.id IS NOT NULL';
}
$accessSql .= implode(' OR ', $accessFilters) . ') LIMIT 1';
$accessStmt = $conn->prepare($accessSql);
if (!$accessStmt) {
    json_response(['status' => 'error', 'message' => 'Access check failed: ' . $conn->error], 500);
}
bind_dynamic($accessStmt, $accessTypes, $accessValues);
$accessStmt->execute();
$currentEntry = $accessStmt->get_result()->fetch_assoc();
if (!$currentEntry) {
    json_response(['status' => 'error', 'message' => 'Entry may not exist or you may not have permission.'], 404);
}

$beforeText = (string) ($currentEntry['current_text'] ?? '');
if (!empty($currentEntry['entry_iv']) && function_exists('decryptDiaryEntry')) {
    $decrypted = decryptDiaryEntry($beforeText, (string) $currentEntry['entry_iv']);
    $beforeText = $decrypted === false ? '' : $decrypted;
}

$beforeCommit = [
    'title' => (string) ($currentEntry['current_title'] ?? ''),
    'text' => $beforeText,
    'emotion' => (string) ($currentEntry['current_emotion'] ?? ''),
    'diary_date' => (string) ($currentEntry['current_diary_date'] ?? ''),
];
$afterCommit = [
    'title' => $diaryTitle,
    'text' => trim($data['entry'] ?? $data['entry_text'] ?? ''),
    'emotion' => $emotion,
    'diary_date' => $diaryDate !== '' ? $diaryDate : (string) ($currentEntry['current_diary_date'] ?? ''),
];

$entryIv = '';
if (function_exists('encryptDiaryEntry') && column_exists($conn, $table, 'entry_iv')) {
    $encryptedData = encryptDiaryEntry($entryText);
    $entryText = $encryptedData['ciphertext'];
    $entryIv = $encryptedData['iv'];
}

$sets = ["$textColumn = ?"];
$values = [$entryText];
$types = 's';
if ($entryIv !== '') {
    $sets[] = 'entry_iv = ?';
    $values[] = $entryIv;
    $types .= 's';
}
if ($emotionColumn !== '') {
    $sets[] = "$emotionColumn = ?";
    $values[] = $emotion;
    $types .= 's';
}
if (column_exists($conn, $table, 'diary_title')) {
    $sets[] = 'diary_title = ?';
    $values[] = $diaryTitle;
    $types .= 's';
}
if ($diaryDate !== '' && column_exists($conn, $table, 'diary_date')) {
    $sets[] = 'diary_date = ?';
    $values[] = $diaryDate;
    $types .= 's';
}

$where = 'id = ?';
$values[] = $entryId;
$types .= 'i';

$sql = 'UPDATE ' . $table . ' SET ' . implode(', ', $sets) . ' WHERE ' . $where;
$stmt = $conn->prepare($sql);
if (!$stmt) {
    json_response(['status' => 'error', 'message' => 'Query prepare failed: ' . $conn->error], 500);
}

bind_dynamic($stmt, $types, $values);

if (!$stmt->execute()) {
    json_response(['status' => 'error', 'message' => 'Update failed: ' . $stmt->error], 500);
}

record_diary_commit($conn, $entryId, $profile, $beforeCommit, $afterCommit, trim((string) ($data['commit_message'] ?? 'Updated diary entry')));

$tradeType = strtolower(trim($data['trade_type'] ?? ''));
$asset = strtoupper(trim($data['asset'] ?? ''));
$buyPrice = isset($data['entry_price']) && $data['entry_price'] !== '' ? (float) $data['entry_price'] : null;
$sellPrice = isset($data['exit_price']) && $data['exit_price'] !== '' ? (float) $data['exit_price'] : null;
if ($asset !== '' || in_array($tradeType, ['buy', 'sell'], true) || $buyPrice !== null || $sellPrice !== null) {
    if (!in_array($tradeType, ['buy', 'sell'], true)) {
        $tradeType = $sellPrice !== null ? 'sell' : 'buy';
    }
    $asset = preg_replace('/[^A-Z0-9._-]/', '', $asset) ?: 'UNKNOWN';
    $tradeStmt = $conn->prepare(
        'INSERT INTO trades (user_id, diary_entry_id, asset, trade_type, buy_price, sell_price, trade_date)
         VALUES (?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE asset = VALUES(asset), trade_type = VALUES(trade_type), buy_price = VALUES(buy_price), sell_price = VALUES(sell_price)'
    );
    if (!$tradeStmt) {
        error_log("Trade statement prepare failed: " . $conn->error);
    } else {
        $tradeStmt->bind_param('iissdd', $userId, $entryId, $asset, $tradeType, $buyPrice, $sellPrice);
        if (!$tradeStmt->execute()) {
            error_log("Trade upsert failed: " . $tradeStmt->error);
        }
        $tradeStmt->close();
    }
}

json_response(['status' => 'success']);
?>
