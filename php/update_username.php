<?php
require_once __DIR__ . '/api_helpers.php';

function normalize_username(string $username): string {
    $username = strtolower(trim($username));
    $username = preg_replace('/[^a-z0-9_]/', '', $username);
    return substr($username, 0, 32);
}

function ensure_username_change_storage(mysqli $conn): void {
    if (!column_exists($conn, 'diaryusers', 'username_changed_at')) {
        $conn->query('ALTER TABLE diaryusers ADD COLUMN username_changed_at DATETIME NULL');
    }

    $conn->query(
        "CREATE TABLE IF NOT EXISTS username_change_logs (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id INT NOT NULL,
            email VARCHAR(190) NOT NULL,
            old_username VARCHAR(120) NOT NULL,
            new_username VARCHAR(120) NOT NULL,
            changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            ip_address VARCHAR(45) NULL,
            user_agent VARCHAR(255) NULL,
            PRIMARY KEY (id),
            KEY idx_username_change_user_date (user_id, changed_at),
            KEY idx_username_change_old_new (old_username, new_username)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

function update_username_column(mysqli $conn, string $table, string $column, string $whereColumn, string $types, array $values): int {
    if (!table_exists($conn, $table) || !column_exists($conn, $table, $column) || !column_exists($conn, $table, $whereColumn)) {
        return 0;
    }

    $stmt = $conn->prepare("UPDATE $table SET $column = ? WHERE $whereColumn = ?");
    if (!$stmt) {
        return 0;
    }

    bind_dynamic($stmt, $types, $values);
    $stmt->execute();
    return max(0, $stmt->affected_rows);
}

function replace_username_in_notifications(mysqli $conn, int $userId, string $oldUsername, string $newUsername): int {
    if (!table_exists($conn, 'diary_notifications')) {
        return 0;
    }

    $updated = 0;
    if (column_exists($conn, 'diary_notifications', 'sender_username') && column_exists($conn, 'diary_notifications', 'sender_id')) {
        $stmt = $conn->prepare('UPDATE diary_notifications SET sender_username = ? WHERE sender_id = ?');
        if ($stmt) {
            $stmt->bind_param('si', $newUsername, $userId);
            $stmt->execute();
            $updated += max(0, $stmt->affected_rows);
        }
    }

    if (column_exists($conn, 'diary_notifications', 'message')) {
        $message = $conn->prepare('UPDATE diary_notifications SET message = REPLACE(message, ?, ?) WHERE message LIKE ?');
        if ($message) {
            $like = '%' . $oldUsername . '%';
            $message->bind_param('sss', $oldUsername, $newUsername, $like);
            $message->execute();
            $updated += max(0, $message->affected_rows);
        }
    }

    return $updated;
}

$data = input_json();
$email = clean_email($data['email'] ?? $data['user_email'] ?? '');
$newUsername = normalize_username((string) ($data['username'] ?? ''));

if (strlen($newUsername) < 3) {
    json_response(['status' => 'error', 'message' => 'Choose a username with at least 3 letters, numbers, or underscores.'], 400);
}

ensure_username_change_storage($conn);

$stmt = $conn->prepare('SELECT id, username, full_name, email, username_changed_at FROM diaryusers WHERE email = ? LIMIT 1');
$stmt->bind_param('s', $email);
$stmt->execute();
$user = $stmt->get_result()->fetch_assoc();

if (!$user) {
    json_response(['status' => 'error', 'message' => 'User account was not found'], 404);
}

$userId = (int) $user['id'];
$oldUsername = (string) ($user['username'] ?? '');
if ($newUsername === $oldUsername) {
    json_response(['status' => 'error', 'message' => 'This is already your username.'], 400);
}

$lastChanged = $user['username_changed_at'] ?? null;
if ($lastChanged && strtotime($lastChanged . ' +1 year') > time()) {
    json_response([
        'status' => 'error',
        'message' => 'You can change your username only once in a year.',
        'next_change_at' => date('Y-m-d H:i:s', strtotime($lastChanged . ' +1 year')),
    ], 429);
}

$check = $conn->prepare('SELECT id FROM diaryusers WHERE username = ? AND id <> ? LIMIT 1');
$check->bind_param('si', $newUsername, $userId);
$check->execute();
if ($check->get_result()->fetch_assoc()) {
    json_response(['status' => 'error', 'message' => 'That username is already taken. Try another one.'], 409);
}

try {
    $conn->begin_transaction();

    $updateUser = $conn->prepare('UPDATE diaryusers SET username = ?, username_changed_at = NOW() WHERE id = ?');
    $updateUser->bind_param('si', $newUsername, $userId);
    if (!$updateUser->execute()) {
        throw new RuntimeException('Could not update username.');
    }

    $updatedPlaces = 0;
    $diaryTable = null;
    try {
        $diaryTable = diary_table($conn);
    } catch (Throwable $e) {
        $diaryTable = null;
    }

    if ($diaryTable && column_exists($conn, $diaryTable, 'user_username') && column_exists($conn, $diaryTable, 'user_id')) {
        $updatedPlaces += update_username_column($conn, $diaryTable, 'user_username', 'user_id', 'si', [$newUsername, $userId]);
    }
    if ($diaryTable && column_exists($conn, $diaryTable, 'user_username') && column_exists($conn, $diaryTable, 'user_email')) {
        $updatedPlaces += update_username_column($conn, $diaryTable, 'user_username', 'user_email', 'ss', [$newUsername, $email]);
    }

    $updatedPlaces += update_username_column($conn, 'diary_entry_commits', 'author_username', 'author_user_id', 'si', [$newUsername, $userId]);
    $updatedPlaces += update_username_column($conn, 'diary_people', 'linked_username', 'linked_user_id', 'si', [$newUsername, $userId]);

    if (table_exists($conn, 'diary_people') && column_exists($conn, 'diary_people', 'linked_username') && column_exists($conn, 'diary_people', 'linked_email')) {
        $updatedPlaces += update_username_column($conn, 'diary_people', 'linked_username', 'linked_email', 'ss', [$newUsername, $email]);
    }

    $updatedPlaces += replace_username_in_notifications($conn, $userId, $oldUsername, $newUsername);

    $ip = substr((string) ($_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? ''), 0, 45);
    $agent = substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255);
    $log = $conn->prepare('INSERT INTO username_change_logs (user_id, email, old_username, new_username, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?)');
    $log->bind_param('isssss', $userId, $email, $oldUsername, $newUsername, $ip, $agent);
    $log->execute();

    $conn->commit();
} catch (Throwable $e) {
    try {
        $conn->rollback();
    } catch (Throwable $rollbackError) {
        error_log('Username update rollback failed: ' . $rollbackError->getMessage());
    }
    error_log('Username update failed: ' . $e->getMessage());
    json_response(['status' => 'error', 'message' => 'Could not change username right now.'], 500);
}

$nextChangeAt = date('Y-m-d H:i:s', strtotime('+1 year'));
json_response([
    'status' => 'success',
    'message' => 'Username changed. Your collaborations and shared diary history now use the new username.',
    'user' => [
        'id' => $userId,
        'email' => $email,
        'full_name' => $user['full_name'] ?? '',
        'username' => $newUsername,
        'username_changed_at' => date('Y-m-d H:i:s'),
        'can_change_username' => false,
        'next_username_change_at' => $nextChangeAt,
    ],
    'old_username' => $oldUsername,
    'new_username' => $newUsername,
    'updated_places' => $updatedPlaces,
    'next_change_at' => $nextChangeAt,
]);
?>
