<?php
require_once __DIR__ . '/api_helpers.php';

$method = $_SERVER['REQUEST_METHOD'];
$data = $method === 'GET' ? $_GET : input_json();
$email = clean_email($data['email'] ?? '');
$userId = require_user_id($conn, $email);

if ($method === 'DELETE' || (($data['action'] ?? '') === 'delete')) {
    $tradeId = (int) ($data['trade_id'] ?? 0);
    if ($tradeId <= 0) {
        json_response(['status' => 'error', 'message' => 'Trade id is required'], 400);
    }

    $stmt = $conn->prepare('SELECT diary_entry_id FROM trades WHERE id = ? AND user_id = ? LIMIT 1');
    $stmt->bind_param('ii', $tradeId, $userId);
    $stmt->execute();
    $trade = $stmt->get_result()->fetch_assoc();
    if (!$trade) {
        json_response(['status' => 'error', 'message' => 'Trade journal was not found'], 404);
    }

    $delete = $conn->prepare('DELETE FROM trades WHERE id = ? AND user_id = ?');
    $delete->bind_param('ii', $tradeId, $userId);
    $delete->execute();

    $entryId = (int) ($trade['diary_entry_id'] ?? 0);
    if ($entryId > 0) {
        $table = diary_table($conn);
        $where = 'id = ?';
        $types = 'i';
        $values = [$entryId];
        if (column_exists($conn, $table, 'owner_id')) {
            $where .= ' AND owner_id = ?';
            $types .= 'i';
            $values[] = $userId;
        } elseif (column_exists($conn, $table, 'user_email')) {
            $where .= ' AND user_email = ?';
            $types .= 's';
            $values[] = $email;
        }
        $entryDelete = $conn->prepare("DELETE FROM $table WHERE $where");
        bind_dynamic($entryDelete, $types, $values);
        $entryDelete->execute();
    }

    json_response(['status' => 'success']);
}

if (!table_exists($conn, 'trades')) {
    json_response(['status' => 'success', 'trades' => []]);
}

$stmt = $conn->prepare(
    'SELECT id, diary_entry_id, asset, trade_type, buy_price, sell_price, trade_date, created_at
     FROM trades WHERE user_id = ? ORDER BY trade_date DESC, id DESC LIMIT 50'
);
$stmt->bind_param('i', $userId);
$stmt->execute();
$trades = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

json_response(['status' => 'success', 'trades' => $trades]);
?>
