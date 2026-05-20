<?php
require_once __DIR__ . '/config.php';

function wallet_json(array $payload, int $statusCode = 200): void {
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload);
    exit;
}

function wallet_input(): array {
    $data = json_decode(file_get_contents('php://input'), true);
    return is_array($data) ? $data : [];
}

function wallet_email(string $email): string {
    $email = trim($email);
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        wallet_json(['status' => 'error', 'message' => 'Valid email is required'], 400);
    }
    return $email;
}

function wallet_column_exists(mysqli $conn, string $table, string $column): bool {
    $stmt = $conn->prepare(
        'SELECT COUNT(*) AS c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?'
    );
    $stmt->bind_param('ss', $table, $column);
    $stmt->execute();
    return (int) $stmt->get_result()->fetch_assoc()['c'] > 0;
}

function wallet_tables(mysqli $conn): void {
    $conn->query(
        "CREATE TABLE IF NOT EXISTS user_wallets (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id INT NOT NULL,
            wallet_address VARCHAR(42) NOT NULL,
            wallet_type VARCHAR(32) NOT NULL DEFAULT 'evm',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_user_wallet (user_id),
            KEY idx_wallet_address (wallet_address)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    if (!wallet_column_exists($conn, 'user_wallets', 'wallet_type')) {
        $conn->query("ALTER TABLE user_wallets ADD COLUMN wallet_type VARCHAR(32) NOT NULL DEFAULT 'evm' AFTER wallet_address");
    }
}

try {
    $data = wallet_input();
    $email = wallet_email($data['email'] ?? '');

    $stmt = $conn->prepare('SELECT id FROM diaryusers WHERE email = ? LIMIT 1');
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();

    if (!$user) {
        wallet_json(['status' => 'error', 'message' => 'User account was not found'], 404);
    }

    wallet_tables($conn);

    $userId = (int) $user['id'];
    $stmt = $conn->prepare('SELECT wallet_address, wallet_type FROM user_wallets WHERE user_id = ? LIMIT 1');
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();

    wallet_json([
        'status' => 'success',
        'wallet_address' => $row['wallet_address'] ?? '',
        'wallet_type' => $row['wallet_type'] ?? 'evm',
    ]);
} catch (Throwable $e) {
    error_log('get_wallet.php: ' . $e->getMessage());
    wallet_json(['status' => 'error', 'message' => 'Wallet lookup failed'], 500);
}
?>
