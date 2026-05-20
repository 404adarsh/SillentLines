<?php
require_once __DIR__ . '/api_helpers.php';

function ensure_username_change_columns(mysqli $conn): void {
    if (!column_exists($conn, 'diaryusers', 'username_changed_at')) {
        $conn->query('ALTER TABLE diaryusers ADD COLUMN username_changed_at DATETIME NULL');
    }
}

$data = input_json();
$email = clean_email($data['email'] ?? $data['user_email'] ?? '');
ensure_username_change_columns($conn);

$stmt = $conn->prepare('SELECT id, username, full_name, email, created_at, username_changed_at FROM diaryusers WHERE email = ? LIMIT 1');
$stmt->bind_param('s', $email);
$stmt->execute();
$user = $stmt->get_result()->fetch_assoc();

if (!$user) {
    json_response(['status' => 'error', 'message' => 'User account was not found'], 404);
}

$lastChanged = $user['username_changed_at'] ?? null;
$nextChangeAt = null;
$canChange = true;
if ($lastChanged) {
    $nextChangeAt = date('Y-m-d H:i:s', strtotime($lastChanged . ' +1 year'));
    $canChange = strtotime($nextChangeAt) <= time();
}

$user['can_change_username'] = $canChange;
$user['next_username_change_at'] = $nextChangeAt;

json_response(['status' => 'success', 'user' => $user]);
?>
