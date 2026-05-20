<?php
require_once __DIR__ . '/api_helpers.php';

$data = input_json();
$email = clean_email($data['email'] ?? $data['user_email'] ?? $data['owner_email'] ?? '');
$entryText = trim($data['entry'] ?? $data['entry_text'] ?? '');
$emotion = preg_replace('/[^a-z_ -]/i', '', $data['emotion'] ?? $data['mood'] ?? '');

if ($entryText === '') {
    json_response(['status' => 'error', 'message' => 'Entry text is required'], 400);
}

$userId = require_user_id($conn, $email);
$profile = user_profile($conn, $email);
$table = diary_table($conn);
ensure_diary_metadata_columns($conn, $table);
$textColumn = column_exists($conn, $table, 'entry_text') ? 'entry_text' : 'entry';
$emotionColumn = column_exists($conn, $table, 'emotion') ? 'emotion' : (column_exists($conn, $table, 'mood') ? 'mood' : '');
$diaryTitle = trim((string) ($data['diary_title'] ?? $data['title'] ?? ''));
$diaryTitle = substr($diaryTitle, 0, 180);
$diaryDate = trim((string) ($data['diary_date'] ?? ''));
if ($diaryDate !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $diaryDate)) {
    $diaryDate = '';
}

$columns = [$textColumn];
$entryIv = '';
if (function_exists('encryptDiaryEntry') && column_exists($conn, $table, 'entry_iv')) {
    $encryptedData = encryptDiaryEntry($entryText);
    $entryText = $encryptedData['ciphertext'];
    $entryIv = $encryptedData['iv'];
}

$values = [$entryText];
$types = 's';

if ($emotionColumn !== '') {
    $columns[] = $emotionColumn;
    $values[] = $emotion;
    $types .= 's';
}
if (column_exists($conn, $table, 'diary_title')) {
    $columns[] = 'diary_title';
    $values[] = $diaryTitle;
    $types .= 's';
}
if (column_exists($conn, $table, 'diary_date')) {
    $columns[] = 'diary_date';
    $values[] = $diaryDate !== '' ? $diaryDate : date('Y-m-d');
    $types .= 's';
}
if (column_exists($conn, $table, 'user_id')) {
    $columns[] = 'user_id';
    $values[] = $userId;
    $types .= 'i';
}
if (column_exists($conn, $table, 'owner_id')) {
    $columns[] = 'owner_id';
    $values[] = (int) $profile['id'];
    $types .= 'i';
}
if (column_exists($conn, $table, 'email')) {
    $columns[] = 'email';
    $values[] = $email;
    $types .= 's';
}
if (column_exists($conn, $table, 'user_email')) {
    $columns[] = 'user_email';
    $values[] = $email;
    $types .= 's';
}
if (column_exists($conn, $table, 'user_username')) {
    $columns[] = 'user_username';
    $values[] = $profile['username'] ?? '';
    $types .= 's';
}
if (column_exists($conn, $table, 'user_full_name')) {
    $columns[] = 'user_full_name';
    $values[] = $profile['full_name'] ?? '';
    $types .= 's';
}
if (column_exists($conn, $table, 'owner_email')) {
    $columns[] = 'owner_email';
    $values[] = $email;
    $types .= 's';
}
if ($entryIv !== '' && column_exists($conn, $table, 'entry_iv')) {
    $columns[] = 'entry_iv';
    $values[] = $entryIv;
    $types .= 's';
}
if (column_exists($conn, $table, 'created_at')) {
    $columns[] = 'created_at';
    $values[] = date('Y-m-d H:i:s');
    $types .= 's';
}

$placeholders = implode(',', array_fill(0, count($columns), '?'));
$sql = 'INSERT INTO ' . $table . ' (' . implode(',', $columns) . ') VALUES (' . $placeholders . ')';
$stmt = $conn->prepare($sql);
if (!$stmt) {
    json_response(['status' => 'error', 'message' => 'Query prepare failed: ' . $conn->error], 500);
}

bind_dynamic($stmt, $types, $values);

if (!$stmt->execute()) {
    json_response(['status' => 'error', 'message' => 'Insert failed: ' . $stmt->error], 500);
}

$entryId = $stmt->insert_id;
if ($entryId <= 0) {
    json_response(['status' => 'error', 'message' => 'Failed to get entry ID'], 500);
}

record_diary_commit(
    $conn,
    $entryId,
    $profile,
    ['title' => '', 'text' => '', 'emotion' => '', 'diary_date' => ''],
    ['title' => $diaryTitle, 'text' => trim($data['entry'] ?? $data['entry_text'] ?? ''), 'emotion' => $emotion, 'diary_date' => $diaryDate !== '' ? $diaryDate : date('Y-m-d')],
    'Created diary entry'
);

$tradeType = strtolower(trim($data['trade_type'] ?? ''));
$asset = strtoupper(trim($data['asset'] ?? ''));
$buyPrice = isset($data['entry_price']) && $data['entry_price'] !== '' ? (float) $data['entry_price'] : null;
$sellPrice = isset($data['exit_price']) && $data['exit_price'] !== '' ? (float) $data['exit_price'] : null;

if ($asset !== '' || in_array($tradeType, ['buy', 'sell'], true) || $buyPrice !== null || $sellPrice !== null) {
    ensure_trades_table($conn);
    if (!in_array($tradeType, ['buy', 'sell'], true)) {
        $tradeType = $sellPrice !== null ? 'sell' : 'buy';
    }
    $asset = preg_replace('/[^A-Z0-9._-]/', '', $asset) ?: 'UNKNOWN';
    $tradeStmt = $conn->prepare(
        'INSERT INTO trades (user_id, diary_entry_id, asset, trade_type, buy_price, sell_price, trade_date)
         VALUES (?, ?, ?, ?, ?, ?, NOW())'
    );
    if (!$tradeStmt) {
        error_log("Trade statement prepare failed: " . $conn->error);
    } else {
        $tradeStmt->bind_param('iissdd', $userId, $entryId, $asset, $tradeType, $buyPrice, $sellPrice);
        if (!$tradeStmt->execute()) {
            error_log("Trade insert failed: " . $tradeStmt->error);
        }
        $tradeStmt->close();
    }
}

json_response(['status' => 'success', 'id' => $entryId]);
?>
