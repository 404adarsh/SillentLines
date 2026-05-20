<?php
require_once __DIR__ . '/api_helpers.php';

$data = input_json();
$email = clean_email($data['email'] ?? $data['user_email'] ?? '');
$token = trim((string) ($data['token'] ?? ''));
$tokenFingerprint = $token !== '' ? hash('sha256', $token) : '';
$fullName = trim((string) ($data['name'] ?? $data['full_name'] ?? $data['user_full_name'] ?? ''));
$requestedUsername = trim((string) ($data['username'] ?? $data['user_username'] ?? ''));

$stmt = $conn->prepare('SELECT id, username, full_name, email FROM diaryusers WHERE email = ? LIMIT 1');
if (!$stmt) {
    json_response(['status' => 'error', 'message' => 'User lookup prepare failed: ' . $conn->error], 500);
}

$stmt->bind_param('s', $email);
if (!$stmt->execute()) {
    json_response(['status' => 'error', 'message' => 'User lookup failed: ' . $stmt->error], 500);
}

$existing = $stmt->get_result()->fetch_assoc();
if ($existing) {
    $updates = [];
    $values = [];
    $types = '';

    if ($fullName !== '' && empty($existing['full_name']) && column_exists($conn, 'diaryusers', 'full_name')) {
        $updates[] = 'full_name = ?';
        $values[] = $fullName;
        $types .= 's';
    }

    if ($tokenFingerprint !== '' && column_exists($conn, 'diaryusers', 'auth0_token')) {
        $updates[] = 'auth0_token = ?';
        $values[] = $tokenFingerprint;
        $types .= 's';
    }

    if ($updates) {
        $values[] = (int) $existing['id'];
        $types .= 'i';
        $update = $conn->prepare('UPDATE diaryusers SET ' . implode(', ', $updates) . ' WHERE id = ?');
        if ($update) {
            bind_dynamic($update, $types, $values);
            $update->execute();
        }
    }

    json_response([
        'status' => 'exists',
        'user_id' => (int) $existing['id'],
        'username' => $existing['username'] ?? '',
    ]);
}

$base = preg_replace('/[^a-zA-Z0-9]/', '', $requestedUsername ?: $fullName);
$base = $base !== '' ? substr($base, 0, 32) : 'user';

do {
    $username = strtolower($base) . rand(1000, 9999);
    $check = $conn->prepare('SELECT id FROM diaryusers WHERE username = ? LIMIT 1');
    if (!$check) {
        json_response(['status' => 'error', 'message' => 'Username check prepare failed: ' . $conn->error], 500);
    }
    $check->bind_param('s', $username);
    $check->execute();
    $usernameExists = (bool) $check->get_result()->fetch_assoc();
} while ($usernameExists);

$columns = ['email', 'username'];
$values = [$email, $username];
$types = 'ss';

if (column_exists($conn, 'diaryusers', 'auth0_token')) {
    $columns[] = 'auth0_token';
    $values[] = $tokenFingerprint;
    $types .= 's';
}

if (column_exists($conn, 'diaryusers', 'full_name')) {
    $columns[] = 'full_name';
    $values[] = $fullName;
    $types .= 's';
}

if (column_exists($conn, 'diaryusers', 'login_time_ist')) {
    $columns[] = 'login_time_ist';
    $values[] = date('Y-m-d H:i:s');
    $types .= 's';
}

$placeholders = implode(',', array_fill(0, count($columns), '?'));
$insert = $conn->prepare('INSERT INTO diaryusers (' . implode(',', $columns) . ') VALUES (' . $placeholders . ')');
if (!$insert) {
    json_response(['status' => 'error', 'message' => 'User insert prepare failed: ' . $conn->error], 500);
}

bind_dynamic($insert, $types, $values);
if (!$insert->execute()) {
    json_response(['status' => 'error', 'message' => 'User insert failed: ' . $insert->error], 500);
}

json_response([
    'status' => 'created',
    'user_id' => $insert->insert_id,
    'username' => $username,
]);
?>
