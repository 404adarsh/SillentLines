<?php
require_once __DIR__ . '/api_helpers.php';

$data = input_json();
$email = clean_email($data['email'] ?? '');
$entryId = (int) ($data['entry_id'] ?? 0);

if ($entryId <= 0) {
    json_response(['status' => 'error', 'message' => 'Entry ID is required'], 400);
}

$userId = require_user_id($conn, $email);
$table = diary_table($conn);

$where = 'id = ?';
$values = [$entryId];
$types = 'i';

if (column_exists($conn, $table, 'user_id')) {
    $where .= ' AND user_id = ?';
    $values[] = $userId;
    $types .= 'i';
} elseif (column_exists($conn, $table, 'owner_email')) {
    $where .= ' AND owner_email = ?';
    $values[] = $email;
    $types .= 's';
} elseif (column_exists($conn, $table, 'email')) {
    $where .= ' AND email = ?';
    $values[] = $email;
    $types .= 's';
}

$sql = 'DELETE FROM ' . $table . ' WHERE ' . $where;
$stmt = $conn->prepare($sql);
if (!$stmt) {
    json_response(['status' => 'error', 'message' => 'Query prepare failed: ' . $conn->error], 500);
}

bind_dynamic($stmt, $types, $values);

if (!$stmt->execute()) {
    json_response(['status' => 'error', 'message' => 'Delete failed: ' . $stmt->error], 500);
}

if ($stmt->affected_rows === 0) {
    json_response(['status' => 'error', 'message' => 'No rows were deleted. Entry may not exist or you may not have permission.'], 404);
}

// Also delete associated trades
$tradeDeleteStmt = $conn->prepare('DELETE FROM trades WHERE diary_entry_id = ?');
if ($tradeDeleteStmt) {
    $tradeDeleteStmt->bind_param('i', $entryId);
    $tradeDeleteStmt->execute();
    $tradeDeleteStmt->close();
}

json_response(['status' => 'success', 'message' => 'Entry deleted successfully']);
?>
