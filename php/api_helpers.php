<?php
if (file_exists(__DIR__ . '/config.php')) {
    require_once __DIR__ . '/config.php';
} else {
    require_once __DIR__ . '/db.php';
}

date_default_timezone_set('Asia/Kolkata');

$secretsPath = __DIR__ . '/secrets.php';
if (file_exists($secretsPath)) {
    require_once $secretsPath;
}

$corsHandler = realpath(__DIR__ . '/../../cors-handler.php');
if ($corsHandler && file_exists($corsHandler)) {
    require_once $corsHandler;
}

function json_response(array $payload, int $statusCode = 200): void {
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
    header('X-Frame-Options: DENY');

    if (!headers_sent() && !headers_list_contains('Access-Control-Allow-Origin')) {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        $configuredOrigins = array_filter(array_map('trim', explode(',', env_value('DIARY_ALLOWED_ORIGINS'))));
        $allowedOrigins = $configuredOrigins ?: [
            'http://localhost:2228',
            'http://127.0.0.1:2228',
        ];

        if (in_array($origin, $allowedOrigins, true)) {
            header("Access-Control-Allow-Origin: $origin");
            header('Access-Control-Allow-Credentials: true');
        } else {
            header('Access-Control-Allow-Origin: http://localhost:2228');
            header('Access-Control-Allow-Credentials: true');
        }

        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept, Origin');
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    }

    echo json_encode($payload);
    exit;
}

set_exception_handler(function (Throwable $e): void {
    error_log('Diary API exception: ' . $e->getMessage());
    if (!headers_sent()) {
        json_response(['status' => 'error', 'message' => 'Server error. Please try again.'], 500);
    }
    exit;
});

register_shutdown_function(function (): void {
    $error = error_get_last();
    if (!$error || !in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        return;
    }
    error_log('Diary API fatal error: ' . ($error['message'] ?? 'unknown'));
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['status' => 'error', 'message' => 'Server error. Please try again.']);
    }
});

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    json_response(['status' => 'ok']);
}

function headers_list_contains(string $headerName): bool {
    $needle = strtolower($headerName) . ':';
    foreach (headers_list() as $header) {
        if (strpos(strtolower($header), $needle) === 0) {
            return true;
        }
    }
    return false;
}

function input_json(): array {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        json_response(['status' => 'error', 'message' => 'POST request required'], 405);
    }
    $raw = file_get_contents('php://input');
    if (strlen($raw) > 1024 * 1024) {
        json_response(['status' => 'error', 'message' => 'Request body is too large'], 413);
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function clean_email(string $email): string {
    $email = trim($email);
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_response(['status' => 'error', 'message' => 'Valid email is required'], 400);
    }
    return $email;
}

function clean_eth_address(string $address): string {
    $address = strtolower(trim($address));
    if (!preg_match('/^0x[a-f0-9]{40}$/', $address)) {
        json_response(['status' => 'error', 'message' => 'Valid wallet address is required'], 400);
    }
    return $address;
}

function require_user_id(mysqli $conn, string $email): int {
    $email = clean_email($email);
    $stmt = $conn->prepare('SELECT id FROM diaryusers WHERE email = ? LIMIT 1');
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();

    if (!$row) {
        json_response(['status' => 'error', 'message' => 'User account was not found'], 404);
    }

    return (int) $row['id'];
}

function ensure_wallet_tables(mysqli $conn): void {
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

    if (!column_exists($conn, 'user_wallets', 'wallet_type')) {
        $conn->query("ALTER TABLE user_wallets ADD COLUMN wallet_type VARCHAR(32) NOT NULL DEFAULT 'evm' AFTER wallet_address");
    }
}

function ensure_trades_table(mysqli $conn): void {
    $conn->query(
        "CREATE TABLE IF NOT EXISTS trades (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id INT NOT NULL,
            diary_entry_id INT NULL,
            asset VARCHAR(32) NOT NULL,
            trade_type ENUM('buy', 'sell') NOT NULL DEFAULT 'buy',
            buy_price DECIMAL(24, 8) NULL,
            sell_price DECIMAL(24, 8) NULL,
            trade_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_trade_diary_entry (diary_entry_id),
            KEY idx_trades_user_date (user_id, trade_date),
            KEY idx_trades_asset (asset)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

function table_exists(mysqli $conn, string $table): bool {
    $stmt = $conn->prepare(
        'SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?'
    );
    $stmt->bind_param('s', $table);
    $stmt->execute();
    return (int) $stmt->get_result()->fetch_assoc()['c'] > 0;
}

function app_secret(string $name): string {
    if (defined($name)) {
        $value = constant($name);
        return is_string($value) ? trim($value) : '';
    }

    return env_value($name);
}

function hex_amount_to_float(string $hex, int $decimals): float {
    $hex = strtolower(trim($hex));
    if (strpos($hex, '0x') === 0) {
        $hex = substr($hex, 2);
    }
    if ($hex === '' || $hex === '0') {
        return 0.0;
    }

    $value = 0.0;
    for ($i = 0; $i < strlen($hex); $i++) {
        $value = ($value * 16) + hexdec($hex[$i]);
    }

    return $value / pow(10, max($decimals, 0));
}

function column_exists(mysqli $conn, string $table, string $column): bool {
    $stmt = $conn->prepare(
        'SELECT COUNT(*) AS c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?'
    );
    $stmt->bind_param('ss', $table, $column);
    $stmt->execute();
    return (int) $stmt->get_result()->fetch_assoc()['c'] > 0;
}

function index_exists(mysqli $conn, string $table, string $index): bool {
    $stmt = $conn->prepare(
        'SELECT COUNT(*) AS c FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?'
    );
    $stmt->bind_param('ss', $table, $index);
    $stmt->execute();
    return (int) $stmt->get_result()->fetch_assoc()['c'] > 0;
}

function primary_key_exists(mysqli $conn, string $table): bool {
    return index_exists($conn, $table, 'PRIMARY');
}

function diary_table(mysqli $conn): string {
    foreach (['diary_entries', 'entries', 'journal_entries', 'notes'] as $table) {
        if (table_exists($conn, $table)) {
            return $table;
        }
    }

    json_response(['status' => 'error', 'message' => 'Diary entries table was not found'], 500);
}

function ensure_diary_metadata_columns(mysqli $conn, string $table): void {
    if (!column_exists($conn, $table, 'diary_title')) {
        $conn->query("ALTER TABLE $table ADD COLUMN diary_title VARCHAR(180) NULL AFTER emotion");
    }
    if (!column_exists($conn, $table, 'diary_date')) {
        $conn->query("ALTER TABLE $table ADD COLUMN diary_date DATE NULL AFTER diary_title");
    }
}

function ensure_diary_share_tables(mysqli $conn): void {
    $conn->query(
        "CREATE TABLE IF NOT EXISTS diary_archives (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            entry_id INT NOT NULL,
            user_id INT NOT NULL,
            archived_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_diary_archive_user_entry (user_id, entry_id),
            KEY idx_diary_archives_user_date (user_id, archived_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $conn->query(
        "CREATE TABLE IF NOT EXISTS diary_public_shares (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            entry_id INT NOT NULL,
            token VARCHAR(80) NOT NULL,
            created_by_user_id INT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            revoked_at DATETIME NULL,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_diary_public_token (token),
            UNIQUE KEY uniq_diary_public_entry_creator (entry_id, created_by_user_id),
            KEY idx_diary_public_entry (entry_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $conn->query(
        "CREATE TABLE IF NOT EXISTS diary_collaborators (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            entry_id INT NOT NULL,
            user_id INT NOT NULL,
            owner_id INT NOT NULL,
            status VARCHAR(24) NOT NULL DEFAULT 'pending',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            accepted_at DATETIME NULL,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_diary_collab_entry_user (entry_id, user_id),
            KEY idx_diary_collab_user_status (user_id, status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $conn->query(
        "CREATE TABLE IF NOT EXISTS diary_share_presence (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            token VARCHAR(80) NOT NULL,
            entry_id INT NOT NULL,
            user_id INT NOT NULL DEFAULT 0,
            user_email VARCHAR(190) NOT NULL,
            username VARCHAR(120) NULL,
            full_name VARCHAR(180) NULL,
            role VARCHAR(32) NOT NULL DEFAULT 'collaborator',
            page_index INT NOT NULL DEFAULT 0,
            cursor_hint VARCHAR(120) NULL,
            last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_share_presence_token_user (token, user_id),
            KEY idx_share_presence_token_seen (token, last_seen)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $conn->query(
        "CREATE TABLE IF NOT EXISTS diary_notifications (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            recipient_email VARCHAR(190) NOT NULL,
            sender_id INT NOT NULL DEFAULT 0,
            sender_username VARCHAR(120) NULL,
            entry_id INT NULL,
            message VARCHAR(255) NOT NULL,
            is_read TINYINT(1) NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_diary_notifications_recipient (recipient_email, is_read, created_at),
            KEY idx_diary_notifications_entry (entry_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $conn->query(
        "CREATE TABLE IF NOT EXISTS diary_user_blocks (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            blocker_user_id INT NOT NULL,
            blocked_user_id INT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_diary_user_block (blocker_user_id, blocked_user_id),
            KEY idx_diary_user_blocks_blocked (blocked_user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $conn->query(
        "CREATE TABLE IF NOT EXISTS diary_commit_email_cooldowns (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            entry_id INT NOT NULL,
            recipient_user_id INT NOT NULL DEFAULT 0,
            recipient_email VARCHAR(190) NOT NULL,
            last_email_sent_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_diary_commit_email_recipient (entry_id, recipient_email),
            KEY idx_diary_commit_email_recipient_time (recipient_email, last_email_sent_at),
            KEY idx_diary_commit_email_time (last_email_sent_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    if (!column_exists($conn, 'diary_collaborators', 'entry_id')) {
        $conn->query("ALTER TABLE diary_collaborators ADD COLUMN entry_id INT NOT NULL DEFAULT 0 AFTER id");
    }
    if (!column_exists($conn, 'diary_collaborators', 'user_id')) {
        $conn->query("ALTER TABLE diary_collaborators ADD COLUMN user_id INT NOT NULL DEFAULT 0 AFTER entry_id");
    }
    if (!column_exists($conn, 'diary_collaborators', 'owner_id')) {
        $conn->query("ALTER TABLE diary_collaborators ADD COLUMN owner_id INT NOT NULL DEFAULT 0 AFTER user_id");
    }
    if (!column_exists($conn, 'diary_collaborators', 'status')) {
        $conn->query("ALTER TABLE diary_collaborators ADD COLUMN status VARCHAR(24) NOT NULL DEFAULT 'pending' AFTER owner_id");
    }
    if (!column_exists($conn, 'diary_collaborators', 'created_at')) {
        $conn->query("ALTER TABLE diary_collaborators ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER status");
    }
    if (!column_exists($conn, 'diary_collaborators', 'updated_at')) {
        $conn->query("ALTER TABLE diary_collaborators ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at");
    }
    if (!column_exists($conn, 'diary_collaborators', 'accepted_at')) {
        $conn->query("ALTER TABLE diary_collaborators ADD COLUMN accepted_at DATETIME NULL AFTER updated_at");
    }
    if (!column_exists($conn, 'diary_collaborators', 'notified_at')) {
        $conn->query("ALTER TABLE diary_collaborators ADD COLUMN notified_at DATETIME NULL AFTER accepted_at");
    }
    if (!column_exists($conn, 'diary_collaborators', 'email_sent_at')) {
        $conn->query("ALTER TABLE diary_collaborators ADD COLUMN email_sent_at DATETIME NULL AFTER notified_at");
    }
    if (!column_exists($conn, 'diary_notifications', 'recipient_email')) {
        $conn->query("ALTER TABLE diary_notifications ADD COLUMN recipient_email VARCHAR(190) NOT NULL DEFAULT '' AFTER id");
    }
    if (!column_exists($conn, 'diary_notifications', 'sender_id')) {
        $conn->query("ALTER TABLE diary_notifications ADD COLUMN sender_id INT NOT NULL DEFAULT 0 AFTER recipient_email");
    }
    if (!column_exists($conn, 'diary_notifications', 'sender_username')) {
        $conn->query("ALTER TABLE diary_notifications ADD COLUMN sender_username VARCHAR(120) NULL AFTER sender_id");
    }
    if (!column_exists($conn, 'diary_notifications', 'entry_id')) {
        $conn->query("ALTER TABLE diary_notifications ADD COLUMN entry_id INT NULL AFTER sender_username");
    }
    if (!column_exists($conn, 'diary_notifications', 'message')) {
        $conn->query("ALTER TABLE diary_notifications ADD COLUMN message VARCHAR(255) NOT NULL DEFAULT '' AFTER entry_id");
    }
    if (!column_exists($conn, 'diary_notifications', 'is_read')) {
        $conn->query("ALTER TABLE diary_notifications ADD COLUMN is_read TINYINT(1) NOT NULL DEFAULT 0 AFTER message");
    }
    if (!column_exists($conn, 'diary_notifications', 'created_at')) {
        $conn->query("ALTER TABLE diary_notifications ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER is_read");
    }
    if (!column_exists($conn, 'diary_archives', 'entry_id')) {
        $conn->query("ALTER TABLE diary_archives ADD COLUMN entry_id INT NOT NULL DEFAULT 0 AFTER id");
    }
    if (!column_exists($conn, 'diary_archives', 'user_id')) {
        $conn->query("ALTER TABLE diary_archives ADD COLUMN user_id INT NOT NULL DEFAULT 0 AFTER entry_id");
    }
    if (!column_exists($conn, 'diary_archives', 'archived_at')) {
        $conn->query("ALTER TABLE diary_archives ADD COLUMN archived_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER user_id");
    }
    if (!column_exists($conn, 'diary_public_shares', 'entry_id')) {
        $conn->query("ALTER TABLE diary_public_shares ADD COLUMN entry_id INT NOT NULL DEFAULT 0 AFTER id");
    }
    if (!column_exists($conn, 'diary_public_shares', 'token')) {
        $conn->query("ALTER TABLE diary_public_shares ADD COLUMN token VARCHAR(80) NOT NULL DEFAULT '' AFTER entry_id");
    }
    if (!column_exists($conn, 'diary_public_shares', 'created_by_user_id')) {
        $conn->query("ALTER TABLE diary_public_shares ADD COLUMN created_by_user_id INT NOT NULL DEFAULT 0 AFTER token");
    }
    if (!column_exists($conn, 'diary_public_shares', 'created_at')) {
        $conn->query("ALTER TABLE diary_public_shares ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER created_by_user_id");
    }
    if (!column_exists($conn, 'diary_public_shares', 'revoked_at')) {
        $conn->query("ALTER TABLE diary_public_shares ADD COLUMN revoked_at DATETIME NULL AFTER created_at");
    }
    if (!column_exists($conn, 'diary_public_shares', 'theme_json')) {
        $conn->query("ALTER TABLE diary_public_shares ADD COLUMN theme_json MEDIUMTEXT NULL AFTER revoked_at");
    }
    if (!column_exists($conn, 'diary_commit_email_cooldowns', 'entry_id')) {
        $conn->query("ALTER TABLE diary_commit_email_cooldowns ADD COLUMN entry_id INT NOT NULL DEFAULT 0 AFTER id");
    }
    if (!column_exists($conn, 'diary_commit_email_cooldowns', 'recipient_user_id')) {
        $conn->query("ALTER TABLE diary_commit_email_cooldowns ADD COLUMN recipient_user_id INT NOT NULL DEFAULT 0 AFTER entry_id");
    }
    if (!column_exists($conn, 'diary_commit_email_cooldowns', 'recipient_email')) {
        $conn->query("ALTER TABLE diary_commit_email_cooldowns ADD COLUMN recipient_email VARCHAR(190) NOT NULL DEFAULT '' AFTER recipient_user_id");
    }
    if (!column_exists($conn, 'diary_commit_email_cooldowns', 'last_email_sent_at')) {
        $conn->query("ALTER TABLE diary_commit_email_cooldowns ADD COLUMN last_email_sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER recipient_email");
    }
}

function diary_users_blocked_between(mysqli $conn, int $firstUserId, int $secondUserId): bool {
    ensure_diary_share_tables($conn);
    $stmt = $conn->prepare(
        'SELECT id FROM diary_user_blocks
         WHERE (blocker_user_id = ? AND blocked_user_id = ?)
            OR (blocker_user_id = ? AND blocked_user_id = ?)
         LIMIT 1'
    );
    if (!$stmt) {
        return false;
    }
    $stmt->bind_param('iiii', $firstUserId, $secondUserId, $secondUserId, $firstUserId);
    $stmt->execute();
    return (bool) $stmt->get_result()->fetch_assoc();
}

function diary_mail_secret(string $name, string $fallback = ''): string {
    $value = app_secret($name);
    return $value !== '' ? $value : $fallback;
}

function ensure_diary_email_preference_tables(mysqli $conn): void {
    $conn->query(
        "CREATE TABLE IF NOT EXISTS diary_email_preferences (
            user_id INT NOT NULL,
            disable_all TINYINT(1) NOT NULL DEFAULT 0,
            allow_only_selected_senders TINYINT(1) NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $conn->query(
        "CREATE TABLE IF NOT EXISTS diary_email_entry_mutes (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id INT NOT NULL,
            entry_id INT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_diary_email_entry_mute (user_id, entry_id),
            KEY idx_diary_email_entry_mutes_entry (entry_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $conn->query(
        "CREATE TABLE IF NOT EXISTS diary_email_sender_allowlist (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id INT NOT NULL,
            sender_user_id INT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_diary_email_sender_allow (user_id, sender_user_id),
            KEY idx_diary_email_sender_allow_sender (sender_user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    if (!column_exists($conn, 'diary_email_preferences', 'disable_all')) {
        $conn->query('ALTER TABLE diary_email_preferences ADD COLUMN disable_all TINYINT(1) NOT NULL DEFAULT 0 AFTER user_id');
    }
    if (!column_exists($conn, 'diary_email_preferences', 'allow_only_selected_senders')) {
        $conn->query('ALTER TABLE diary_email_preferences ADD COLUMN allow_only_selected_senders TINYINT(1) NOT NULL DEFAULT 0 AFTER disable_all');
    }
    if (!column_exists($conn, 'diary_email_preferences', 'created_at')) {
        $conn->query('ALTER TABLE diary_email_preferences ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER allow_only_selected_senders');
    }
    if (!column_exists($conn, 'diary_email_preferences', 'updated_at')) {
        $conn->query('ALTER TABLE diary_email_preferences ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at');
    }

    if (!column_exists($conn, 'diary_email_entry_mutes', 'id') && !primary_key_exists($conn, 'diary_email_entry_mutes')) {
        $conn->query('ALTER TABLE diary_email_entry_mutes ADD COLUMN id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST');
    }
    if (!column_exists($conn, 'diary_email_entry_mutes', 'user_id')) {
        $conn->query('ALTER TABLE diary_email_entry_mutes ADD COLUMN user_id INT NOT NULL DEFAULT 0 AFTER id');
    }
    if (!column_exists($conn, 'diary_email_entry_mutes', 'entry_id')) {
        $conn->query('ALTER TABLE diary_email_entry_mutes ADD COLUMN entry_id INT NOT NULL DEFAULT 0 AFTER user_id');
    }
    if (!column_exists($conn, 'diary_email_entry_mutes', 'created_at')) {
        $conn->query('ALTER TABLE diary_email_entry_mutes ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER entry_id');
    }
    if (!index_exists($conn, 'diary_email_entry_mutes', 'uniq_diary_email_entry_mute')) {
        if (column_exists($conn, 'diary_email_entry_mutes', 'id')) {
            $conn->query(
                'DELETE stale FROM diary_email_entry_mutes stale
                 INNER JOIN diary_email_entry_mutes keep
                    ON keep.user_id = stale.user_id
                   AND keep.entry_id = stale.entry_id
                   AND keep.id < stale.id'
            );
        }
        $conn->query('ALTER TABLE diary_email_entry_mutes ADD UNIQUE KEY uniq_diary_email_entry_mute (user_id, entry_id)');
    }
    if (!index_exists($conn, 'diary_email_entry_mutes', 'idx_diary_email_entry_mutes_entry')) {
        $conn->query('ALTER TABLE diary_email_entry_mutes ADD KEY idx_diary_email_entry_mutes_entry (entry_id)');
    }

    if (!column_exists($conn, 'diary_email_sender_allowlist', 'id') && !primary_key_exists($conn, 'diary_email_sender_allowlist')) {
        $conn->query('ALTER TABLE diary_email_sender_allowlist ADD COLUMN id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST');
    }
    if (!column_exists($conn, 'diary_email_sender_allowlist', 'user_id')) {
        $conn->query('ALTER TABLE diary_email_sender_allowlist ADD COLUMN user_id INT NOT NULL DEFAULT 0 AFTER id');
    }
    if (!column_exists($conn, 'diary_email_sender_allowlist', 'sender_user_id')) {
        $conn->query('ALTER TABLE diary_email_sender_allowlist ADD COLUMN sender_user_id INT NOT NULL DEFAULT 0 AFTER user_id');
    }
    if (!column_exists($conn, 'diary_email_sender_allowlist', 'created_at')) {
        $conn->query('ALTER TABLE diary_email_sender_allowlist ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER sender_user_id');
    }
    if (!index_exists($conn, 'diary_email_sender_allowlist', 'uniq_diary_email_sender_allow')) {
        if (column_exists($conn, 'diary_email_sender_allowlist', 'id')) {
            $conn->query(
                'DELETE stale FROM diary_email_sender_allowlist stale
                 INNER JOIN diary_email_sender_allowlist keep
                    ON keep.user_id = stale.user_id
                   AND keep.sender_user_id = stale.sender_user_id
                   AND keep.id < stale.id'
            );
        }
        $conn->query('ALTER TABLE diary_email_sender_allowlist ADD UNIQUE KEY uniq_diary_email_sender_allow (user_id, sender_user_id)');
    }
    if (!index_exists($conn, 'diary_email_sender_allowlist', 'idx_diary_email_sender_allow_sender')) {
        $conn->query('ALTER TABLE diary_email_sender_allowlist ADD KEY idx_diary_email_sender_allow_sender (sender_user_id)');
    }
}

function diary_notification_email_allowed(mysqli $conn, int $recipientUserId, string $recipientEmail, int $senderUserId, int $entryId): bool {
    ensure_diary_email_preference_tables($conn);
    if ($recipientUserId <= 0 && $recipientEmail !== '') {
        $stmt = $conn->prepare('SELECT id FROM diaryusers WHERE LOWER(email) = LOWER(?) LIMIT 1');
        if ($stmt) {
            $stmt->bind_param('s', $recipientEmail);
            $stmt->execute();
            $recipientUserId = (int) ($stmt->get_result()->fetch_assoc()['id'] ?? 0);
        }
    }
    if ($recipientUserId <= 0) {
        return true;
    }

    $prefStmt = $conn->prepare('SELECT disable_all, allow_only_selected_senders FROM diary_email_preferences WHERE user_id = ? LIMIT 1');
    if (!$prefStmt) {
        return true;
    }
    $prefStmt->bind_param('i', $recipientUserId);
    $prefStmt->execute();
    $prefs = $prefStmt->get_result()->fetch_assoc() ?: ['disable_all' => 0, 'allow_only_selected_senders' => 0];
    if (!empty($prefs['disable_all'])) {
        return false;
    }

    if ($entryId > 0) {
        $muteStmt = $conn->prepare('SELECT id FROM diary_email_entry_mutes WHERE user_id = ? AND entry_id = ? LIMIT 1');
        if ($muteStmt) {
            $muteStmt->bind_param('ii', $recipientUserId, $entryId);
            $muteStmt->execute();
            if ($muteStmt->get_result()->fetch_assoc()) {
                return false;
            }
        }
    }

    if (!empty($prefs['allow_only_selected_senders'])) {
        if ($senderUserId <= 0) {
            return false;
        }
        $allowStmt = $conn->prepare('SELECT id FROM diary_email_sender_allowlist WHERE user_id = ? AND sender_user_id = ? LIMIT 1');
        if (!$allowStmt) {
            return false;
        }
        $allowStmt->bind_param('ii', $recipientUserId, $senderUserId);
        $allowStmt->execute();
        return (bool) $allowStmt->get_result()->fetch_assoc();
    }

    return true;
}

function diary_app_url(string $path = ''): string {
    $base = rtrim(diary_mail_secret('DIARY_APP_URL', diary_mail_secret('APP_URL', 'http://localhost:2228')), '/');
    $cleanPath = '/' . ltrim($path, '/');
    return $base . ($cleanPath === '/' ? '' : $cleanPath);
}

function diary_share_entry_title(mysqli $conn, string $table, int $entryId): string {
    if (!column_exists($conn, $table, 'diary_title')) {
        return '';
    }
    $stmt = $conn->prepare("SELECT diary_title FROM $table WHERE id = ? LIMIT 1");
    if (!$stmt) {
        return '';
    }
    $stmt->bind_param('i', $entryId);
    $stmt->execute();
    return (string) (($stmt->get_result()->fetch_assoc()['diary_title'] ?? '') ?: '');
}

function ensure_diary_share_notification(mysqli $conn, string $targetEmail, int $senderId, string $senderUsername, int $entryId): bool {
    ensure_diary_share_tables($conn);
    $message = 'invited you to view and collaborate on a diary entry.';

    $existing = $conn->prepare(
        'SELECT id FROM diary_notifications
         WHERE LOWER(recipient_email) = LOWER(?) AND sender_id = ? AND entry_id = ? AND message = ?
         LIMIT 1'
    );
    $existing->bind_param('siis', $targetEmail, $senderId, $entryId, $message);
    $existing->execute();
    $row = $existing->get_result()->fetch_assoc();

    if ($row) {
        $id = (int) $row['id'];
        $update = $conn->prepare('UPDATE diary_notifications SET sender_username = ?, is_read = 0, created_at = NOW() WHERE id = ?');
        $update->bind_param('si', $senderUsername, $id);
        return $update->execute();
    }

    $insert = $conn->prepare(
        'INSERT INTO diary_notifications (recipient_email, sender_id, sender_username, entry_id, message, is_read, created_at)
         VALUES (?, ?, ?, ?, ?, 0, NOW())'
    );
    $insert->bind_param('sisis', $targetEmail, $senderId, $senderUsername, $entryId, $message);
    return $insert->execute();
}

function send_diary_share_email(string $toEmail, string $senderName, string $entryTitle = ''): bool {
    $autoloadPath = __DIR__ . '/../../vendor/autoload.php';
    if (!file_exists($autoloadPath)) {
        error_log('Diary share email skipped: PHPMailer autoload was not found.');
        return false;
    }

    try {
        require_once $autoloadPath;
        $mail = new PHPMailer\PHPMailer\PHPMailer(true);
        $host = diary_mail_secret('DIARY_SMTP_HOST', diary_mail_secret('SMTP_HOST'));
        $username = diary_mail_secret('DIARY_SMTP_USER', diary_mail_secret('SMTP_USER'));
        $smtpPassword = diary_mail_secret('DIARY_SMTP_PASS', diary_mail_secret('SMTP_PASS'));
        $port = (int) diary_mail_secret('DIARY_SMTP_PORT', diary_mail_secret('SMTP_PORT', '587'));
        $secure = strtolower(diary_mail_secret('DIARY_SMTP_SECURE', diary_mail_secret('SMTP_SECURE', 'tls')));
        $fromEmail = diary_mail_secret('DIARY_MAIL_FROM', diary_mail_secret('SMTP_FROM_EMAIL', $username));
        $fromName = diary_mail_secret('DIARY_MAIL_FROM_NAME', 'SilentLines');

        if ($fromEmail === '') {
            $fromEmail = 'no-reply@localhost.invalid';
        }

        if ($host !== '') {
            $mail->isSMTP();
            $mail->Host = $host;
            $mail->Port = $port > 0 ? $port : 587;
            $mail->SMTPAuth = $username !== '';
            if ($username !== '') {
                $mail->Username = $username;
                $mail->Password = $smtpPassword;
            }
            if (in_array($secure, ['ssl', 'tls'], true)) {
                $mail->SMTPSecure = $secure;
            }
        } else {
            $mail->isMail();
        }

        $safeSender = htmlspecialchars($senderName ?: 'Someone', ENT_QUOTES, 'UTF-8');
        $safeTitle = htmlspecialchars($entryTitle ?: 'a diary entry', ENT_QUOTES, 'UTF-8');
        $appUrl = diary_app_url('/notes');
        $settingsUrl = diary_app_url('/settings');
        $logoUrl = diary_app_url('/logo.png');
        $mail->CharSet = 'UTF-8';
        $mail->setFrom($fromEmail, $fromName);
        $mail->addAddress($toEmail);
        $mail->Subject = $senderName . ' shared a SilentLines diary entry with you';
        $mail->isHTML(true);
        $mail->Body = '
<!doctype html>
<html>
  <body style="margin:0;background:#f7f4ee;font-family:Inter,Arial,sans-serif;color:#1c1917;">
    <div style="display:none;max-height:0;overflow:hidden;">' . $safeSender . ' shared a diary page with you on SilentLines.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f4ee;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border:1px solid #fed7aa;border-radius:22px;overflow:hidden;box-shadow:0 18px 55px rgba(28,25,23,.12);">
            <tr>
              <td style="padding:0;background:linear-gradient(135deg,#0f172a 0%,#7c2d12 46%,#f97316 100%);">
                <div style="padding:28px 28px 34px;background:radial-gradient(circle at 18% 20%,rgba(255,255,255,.28),transparent 28%),radial-gradient(circle at 88% 5%,rgba(255,237,213,.28),transparent 30%);">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="vertical-align:middle;">
                        <img src="' . htmlspecialchars($logoUrl, ENT_QUOTES, 'UTF-8') . '" alt="SilentLines" width="54" height="54" style="display:block;border-radius:16px;background:#fff;padding:4px;box-shadow:0 10px 24px rgba(0,0,0,.18);">
                      </td>
                      <td style="vertical-align:middle;padding-left:14px;">
                        <div style="font-size:22px;font-weight:900;color:#fff;letter-spacing:.2px;">SilentLines</div>
                        <div style="font-size:12px;font-weight:800;color:#ffedd5;letter-spacing:1.4px;text-transform:uppercase;">A private diary invitation</div>
                      </td>
                    </tr>
                  </table>
                  <div style="margin-top:28px;color:#fff;font-size:34px;line-height:1.08;font-weight:950;">' . $safeSender . ' shared a diary page with you.</div>
                  <div style="margin-top:12px;color:#ffedd5;font-size:15px;line-height:1.65;font-weight:700;">A quiet page is waiting in your notifications. Accept it when you are ready, ignore it if it is not for you.</div>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <div style="border-left:5px solid #f97316;background:#fff7ed;border-radius:16px;padding:18px 18px 18px 20px;">
                  <div style="font-size:12px;font-weight:900;color:#ea580c;letter-spacing:1.5px;text-transform:uppercase;">Shared entry</div>
                  <div style="margin-top:8px;font-family:Georgia,serif;font-size:24px;line-height:1.35;font-weight:800;color:#1c1917;">' . $safeTitle . '</div>
                </div>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
                  <tr>
                    <td align="center">
                      <a href="' . htmlspecialchars($appUrl, ENT_QUOTES, 'UTF-8') . '" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;font-size:15px;font-weight:900;border-radius:14px;padding:15px 22px;">Open SilentLines</a>
                    </td>
                  </tr>
                </table>
                <div style="margin-top:24px;padding:16px;border:1px solid #e7e5e4;border-radius:16px;background:#fafaf9;">
                  <div style="font-size:14px;line-height:1.7;color:#44403c;font-weight:700;">You can accept or ignore this collaboration request from the notification bell. If you do not want invites from this user, open Settings and block their username.</div>
                  <div style="margin-top:12px;">
                    <a href="' . htmlspecialchars($settingsUrl, ENT_QUOTES, 'UTF-8') . '" style="color:#c2410c;font-size:13px;font-weight:900;text-decoration:none;">Open sharing settings</a>
                  </div>
                </div>
                <div style="margin-top:24px;text-align:center;color:#a8a29e;font-size:12px;font-weight:700;">Private by default. Shared only by choice.</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>';
        $mail->AltBody = "Hello,\n\n{$senderName} invited you to view and collaborate on {$entryTitle} in SilentLines.\n\nOpen SilentLines: {$appUrl}\n\nYou can accept or ignore the request from the notification bell. If you do not want invites from this user, open Settings: {$settingsUrl}";
        $mail->send();
        return true;
    } catch (Throwable $e) {
        error_log('Diary share email failed: ' . $e->getMessage());
        return false;
    }
}

function send_diary_commit_email(string $toEmail, string $authorName, string $entryTitle = '', string $commitMessage = ''): bool {
    $autoloadPath = __DIR__ . '/../../vendor/autoload.php';
    if (!file_exists($autoloadPath)) {
        error_log('Diary commit email skipped: PHPMailer autoload was not found.');
        return false;
    }

    try {
        require_once $autoloadPath;
        $mail = new PHPMailer\PHPMailer\PHPMailer(true);
        $host = diary_mail_secret('DIARY_SMTP_HOST', diary_mail_secret('SMTP_HOST'));
        $username = diary_mail_secret('DIARY_SMTP_USER', diary_mail_secret('SMTP_USER'));
        $smtpPassword = diary_mail_secret('DIARY_SMTP_PASS', diary_mail_secret('SMTP_PASS'));
        $port = (int) diary_mail_secret('DIARY_SMTP_PORT', diary_mail_secret('SMTP_PORT', '587'));
        $secure = strtolower(diary_mail_secret('DIARY_SMTP_SECURE', diary_mail_secret('SMTP_SECURE', 'tls')));
        $fromEmail = diary_mail_secret('DIARY_MAIL_FROM', diary_mail_secret('SMTP_FROM_EMAIL', $username));
        $fromName = diary_mail_secret('DIARY_MAIL_FROM_NAME', 'SilentLines');

        if ($fromEmail === '') {
            $fromEmail = 'no-reply@localhost.invalid';
        }

        if ($host !== '') {
            $mail->isSMTP();
            $mail->Host = $host;
            $mail->Port = $port > 0 ? $port : 587;
            $mail->SMTPAuth = $username !== '';
            if ($username !== '') {
                $mail->Username = $username;
                $mail->Password = $smtpPassword;
            }
            if (in_array($secure, ['ssl', 'tls'], true)) {
                $mail->SMTPSecure = $secure;
            }
        } else {
            $mail->isMail();
        }

        $safeAuthor = htmlspecialchars($authorName ?: 'Someone', ENT_QUOTES, 'UTF-8');
        $safeTitle = htmlspecialchars($entryTitle ?: 'a diary entry', ENT_QUOTES, 'UTF-8');
        $safeMessage = htmlspecialchars($commitMessage ?: 'Updated diary entry', ENT_QUOTES, 'UTF-8');
        $appUrl = diary_app_url('/notes');
        $logoUrl = diary_app_url('/logo.png');
        $mail->CharSet = 'UTF-8';
        $mail->setFrom($fromEmail, $fromName);
        $mail->addAddress($toEmail);
        $mail->Subject = $authorName . ' added a new diary commit';
        $mail->isHTML(true);
        $mail->Body = '
<!doctype html>
<html>
  <body style="margin:0;background:#f7f4ee;font-family:Inter,Arial,sans-serif;color:#1c1917;">
    <div style="display:none;max-height:0;overflow:hidden;">' . $safeAuthor . ' added a new commit to a diary entry you collaborate on.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f4ee;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border:1px solid #fed7aa;border-radius:22px;overflow:hidden;box-shadow:0 18px 55px rgba(28,25,23,.12);">
            <tr>
              <td style="padding:28px;background:#111827;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align:middle;width:68px;">
                      <img src="' . htmlspecialchars($logoUrl, ENT_QUOTES, 'UTF-8') . '" alt="SilentLines" width="54" height="54" style="display:block;border-radius:16px;background:#fff;padding:4px;">
                    </td>
                    <td style="vertical-align:middle;">
                      <div style="font-size:22px;font-weight:900;color:#fff;">SilentLines</div>
                      <div style="font-size:12px;font-weight:800;color:#ffedd5;letter-spacing:1.4px;text-transform:uppercase;">Diary commit update</div>
                    </td>
                  </tr>
                </table>
                <div style="margin-top:28px;color:#fff;font-size:32px;line-height:1.12;font-weight:950;">' . $safeAuthor . ' added a new commit.</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <div style="border-left:5px solid #f97316;background:#fff7ed;border-radius:16px;padding:18px 18px 18px 20px;">
                  <div style="font-size:12px;font-weight:900;color:#ea580c;letter-spacing:1.5px;text-transform:uppercase;">Diary entry</div>
                  <div style="margin-top:8px;font-family:Georgia,serif;font-size:24px;line-height:1.35;font-weight:800;color:#1c1917;">' . $safeTitle . '</div>
                  <div style="margin-top:12px;font-size:14px;line-height:1.7;color:#44403c;font-weight:700;">' . $safeMessage . '</div>
                </div>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
                  <tr>
                    <td align="center">
                      <a href="' . htmlspecialchars($appUrl, ENT_QUOTES, 'UTF-8') . '" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;font-size:15px;font-weight:900;border-radius:14px;padding:15px 22px;">Open commit history</a>
                    </td>
                  </tr>
                </table>
                <div style="margin-top:24px;text-align:center;color:#a8a29e;font-size:12px;font-weight:700;">To reduce noise, commit emails are limited to once per hour.</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>';
        $mail->AltBody = "Hello,\n\n{$authorName} added a new commit to {$entryTitle} in SilentLines.\n\nCommit: {$commitMessage}\n\nOpen SilentLines: {$appUrl}\n\nCommit emails are limited to once per hour.";
        $mail->send();
        return true;
    } catch (Throwable $e) {
        error_log('Diary commit email failed: ' . $e->getMessage());
        return false;
    }
}

function notify_diary_commit_collaborators(mysqli $conn, int $entryId, array $author, string $commitMessage, string $entryTitle = ''): void {
    ensure_diary_share_tables($conn);
    $table = diary_table($conn);
    $participants = diary_commit_recipients($conn, $table, $entryId, $author);
    if (!$participants) {
        return;
    }

    $authorName = (string) (($author['full_name'] ?? '') ?: ($author['username'] ?? '') ?: ($author['email'] ?? 'Someone'));
    $title = $entryTitle !== '' ? $entryTitle : diary_share_entry_title($conn, $table, $entryId);
    foreach ($participants as $recipient) {
        $recipientEmail = (string) ($recipient['email'] ?? '');
        if ($recipientEmail === '' || !filter_var($recipientEmail, FILTER_VALIDATE_EMAIL)) {
            continue;
        }
        if (!diary_notification_email_allowed($conn, (int) ($recipient['id'] ?? 0), $recipientEmail, (int) ($author['id'] ?? 0), $entryId)) {
            continue;
        }
        if (!diary_commit_email_allowed($conn, $entryId, (int) ($recipient['id'] ?? 0), $recipientEmail)) {
            continue;
        }
        if (send_diary_commit_email($recipientEmail, $authorName, $title, $commitMessage)) {
            mark_diary_commit_email_sent($conn, $entryId, (int) ($recipient['id'] ?? 0), $recipientEmail);
        }
    }
}

function diary_commit_recipients(mysqli $conn, string $table, int $entryId, array $author): array {
    $authorId = (int) ($author['id'] ?? 0);
    $authorEmail = strtolower((string) ($author['email'] ?? ''));
    $recipients = [];

    $ownerColumns = [];
    foreach (['user_id', 'owner_id', 'email', 'user_email', 'owner_email'] as $column) {
        if (column_exists($conn, $table, $column)) {
            $ownerColumns[] = $column;
        }
    }
    if ($ownerColumns) {
        $select = implode(', ', $ownerColumns);
        $stmt = $conn->prepare("SELECT $select FROM $table WHERE id = ? LIMIT 1");
        if ($stmt) {
            $stmt->bind_param('i', $entryId);
            $stmt->execute();
            $entry = $stmt->get_result()->fetch_assoc() ?: [];
            foreach (['user_id', 'owner_id'] as $column) {
                $ownerId = (int) ($entry[$column] ?? 0);
                if ($ownerId > 0) {
                    add_diary_commit_recipient_by_id($conn, $recipients, $ownerId, $authorId, $authorEmail);
                }
            }
            foreach (['email', 'user_email', 'owner_email'] as $column) {
                $ownerEmail = (string) ($entry[$column] ?? '');
                if ($ownerEmail !== '') {
                    add_diary_commit_recipient_by_email($conn, $recipients, $ownerEmail, $authorId, $authorEmail);
                }
            }
        }
    }

    if (table_exists($conn, 'diary_collaborators')) {
        $stmt = $conn->prepare(
            "SELECT u.id, u.email, u.username, u.full_name
             FROM diary_collaborators c
             INNER JOIN diaryusers u ON u.id = c.user_id
             WHERE c.entry_id = ? AND c.status = 'accepted'"
        );
        if ($stmt) {
            $stmt->bind_param('i', $entryId);
            $stmt->execute();
            foreach ($stmt->get_result()->fetch_all(MYSQLI_ASSOC) as $row) {
                add_diary_commit_recipient($conn, $recipients, $row, $authorId, $authorEmail);
            }
        }
    }

    return array_values($recipients);
}

function add_diary_commit_recipient_by_id(mysqli $conn, array &$recipients, int $userId, int $authorId, string $authorEmail): void {
    $stmt = $conn->prepare('SELECT id, email, username, full_name FROM diaryusers WHERE id = ? LIMIT 1');
    if (!$stmt) {
        return;
    }
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    if ($row) {
        add_diary_commit_recipient($conn, $recipients, $row, $authorId, $authorEmail);
    }
}

function add_diary_commit_recipient_by_email(mysqli $conn, array &$recipients, string $email, int $authorId, string $authorEmail): void {
    $stmt = $conn->prepare('SELECT id, email, username, full_name FROM diaryusers WHERE LOWER(email) = LOWER(?) LIMIT 1');
    if (!$stmt) {
        return;
    }
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc() ?: ['id' => 0, 'email' => $email, 'username' => '', 'full_name' => ''];
    add_diary_commit_recipient($conn, $recipients, $row, $authorId, $authorEmail);
}

function add_diary_commit_recipient(mysqli $conn, array &$recipients, array $row, int $authorId, string $authorEmail): void {
    $recipientId = (int) ($row['id'] ?? 0);
    $recipientEmail = strtolower((string) ($row['email'] ?? ''));
    if ($recipientEmail === '' || !filter_var($recipientEmail, FILTER_VALIDATE_EMAIL)) {
        return;
    }
    if (($authorId > 0 && $recipientId === $authorId) || ($authorEmail !== '' && $recipientEmail === $authorEmail)) {
        return;
    }
    if ($authorId > 0 && $recipientId > 0 && diary_users_blocked_between($conn, $authorId, $recipientId)) {
        return;
    }
    $recipients[$recipientEmail] = [
        'id' => $recipientId,
        'email' => (string) ($row['email'] ?? ''),
        'username' => (string) ($row['username'] ?? ''),
        'full_name' => (string) ($row['full_name'] ?? ''),
    ];
}

function diary_commit_email_allowed(mysqli $conn, int $entryId, int $recipientUserId, string $recipientEmail): bool {
    $stmt = $conn->prepare(
        'SELECT last_email_sent_at
         FROM diary_commit_email_cooldowns
         WHERE LOWER(recipient_email) = LOWER(?)
         ORDER BY last_email_sent_at DESC
         LIMIT 1'
    );
    if (!$stmt) {
        return false;
    }
    $stmt->bind_param('s', $recipientEmail);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    if (!$row || empty($row['last_email_sent_at'])) {
        return true;
    }
    return strtotime((string) $row['last_email_sent_at']) <= time() - 3600;
}

function mark_diary_commit_email_sent(mysqli $conn, int $entryId, int $recipientUserId, string $recipientEmail): void {
    $stmt = $conn->prepare(
        'INSERT INTO diary_commit_email_cooldowns (entry_id, recipient_user_id, recipient_email, last_email_sent_at)
         VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE recipient_user_id = VALUES(recipient_user_id), last_email_sent_at = NOW()'
    );
    if (!$stmt) {
        error_log('Commit email cooldown update prepare failed: ' . $conn->error);
        return;
    }
    $stmt->bind_param('iis', $entryId, $recipientUserId, $recipientEmail);
    if (!$stmt->execute()) {
        error_log('Commit email cooldown update failed: ' . $stmt->error);
    }
}

function diary_owner_filters(mysqli $conn, string $table, string $alias, int $userId, string $email, string &$types, array &$values): array {
    $filters = [];
    if (column_exists($conn, $table, 'user_id')) {
        $filters[] = "$alias.user_id = ?";
        $types .= 'i';
        $values[] = $userId;
    }
    if (column_exists($conn, $table, 'owner_id')) {
        $filters[] = "$alias.owner_id = ?";
        $types .= 'i';
        $values[] = $userId;
    }
    if (column_exists($conn, $table, 'user_email')) {
        $filters[] = "LOWER($alias.user_email) = LOWER(?)";
        $types .= 's';
        $values[] = $email;
    }
    if (column_exists($conn, $table, 'owner_email')) {
        $filters[] = "LOWER($alias.owner_email) = LOWER(?)";
        $types .= 's';
        $values[] = $email;
    }
    if (column_exists($conn, $table, 'email')) {
        $filters[] = "LOWER($alias.email) = LOWER(?)";
        $types .= 's';
        $values[] = $email;
    }
    return $filters;
}

function user_can_read_entry(mysqli $conn, string $table, int $entryId, int $userId, string $email): bool {
    // Keep this helper as the canonical read-authorization gate for private diary data.
    // New endpoints that return entry content should call this before selecting or serializing rows.
    ensure_diary_share_tables($conn);
    $types = 'i';
    $values = [$entryId];
    $filters = diary_owner_filters($conn, $table, 'd', $userId, $email, $types, $values);
    $join = '';
    if (table_exists($conn, 'diary_collaborators')) {
        $join = " LEFT JOIN diary_collaborators c ON c.entry_id = d.id AND c.user_id = ? AND c.status = 'accepted'";
        $types = 'i' . $types;
        array_unshift($values, $userId);
        $filters[] = 'c.id IS NOT NULL';
    }
    if (!$filters) {
        return false;
    }
    $sql = "SELECT d.id FROM $table d $join WHERE d.id = ? AND (" . implode(' OR ', $filters) . ') LIMIT 1';
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        return false;
    }
    bind_dynamic($stmt, $types, $values);
    $stmt->execute();
    return (bool) $stmt->get_result()->fetch_assoc();
}

function user_owns_entry(mysqli $conn, string $table, int $entryId, int $userId, string $email): bool {
    // Mutating endpoints should require ownership unless the feature explicitly supports collaborator writes.
    $types = 'i';
    $values = [$entryId];
    $filters = diary_owner_filters($conn, $table, 'd', $userId, $email, $types, $values);
    if (!$filters) {
        return false;
    }
    $sql = "SELECT d.id FROM $table d WHERE d.id = ? AND (" . implode(' OR ', $filters) . ') LIMIT 1';
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        return false;
    }
    bind_dynamic($stmt, $types, $values);
    $stmt->execute();
    return (bool) $stmt->get_result()->fetch_assoc();
}

function ensure_diary_commit_tables(mysqli $conn): void {
    $conn->query(
        "CREATE TABLE IF NOT EXISTS diary_entry_commits (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            entry_id INT NOT NULL,
            author_user_id INT NOT NULL,
            author_email VARCHAR(190) NOT NULL,
            author_name VARCHAR(190) NULL,
            author_username VARCHAR(120) NULL,
            commit_message VARCHAR(240) NULL,
            before_title VARCHAR(180) NULL,
            after_title VARCHAR(180) NULL,
            before_text MEDIUMTEXT NULL,
            after_text MEDIUMTEXT NULL,
            before_emotion VARCHAR(60) NULL,
            after_emotion VARCHAR(60) NULL,
            before_diary_date DATE NULL,
            after_diary_date DATE NULL,
            changed_fields VARCHAR(255) NOT NULL DEFAULT '',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_diary_commits_entry_date (entry_id, created_at),
            KEY idx_diary_commits_author (author_user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

function record_diary_commit(mysqli $conn, int $entryId, array $author, array $before, array $after, string $message = ''): void {
    ensure_diary_commit_tables($conn);

    $changed = [];
    foreach (['title', 'text', 'emotion', 'diary_date'] as $field) {
        if ((string) ($before[$field] ?? '') !== (string) ($after[$field] ?? '')) {
            $changed[] = $field;
        }
    }

    if (!$changed && $message !== 'Created diary entry') {
        return;
    }

    $stmt = $conn->prepare(
        'INSERT INTO diary_entry_commits
         (entry_id, author_user_id, author_email, author_name, author_username, commit_message,
          before_title, after_title, before_text, after_text, before_emotion, after_emotion,
          before_diary_date, after_diary_date, changed_fields, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())'
    );

    if (!$stmt) {
        error_log('Commit statement prepare failed: ' . $conn->error);
        return;
    }

    $authorId = (int) ($author['id'] ?? 0);
    $authorEmail = (string) ($author['email'] ?? '');
    $authorName = (string) ($author['full_name'] ?? $author['name'] ?? '');
    $authorUsername = (string) ($author['username'] ?? '');
    $changedFields = implode(',', $changed);
    $beforeTitle = (string) ($before['title'] ?? '');
    $afterTitle = (string) ($after['title'] ?? '');
    $beforeText = (string) ($before['text'] ?? '');
    $afterText = (string) ($after['text'] ?? '');
    $beforeEmotion = (string) ($before['emotion'] ?? '');
    $afterEmotion = (string) ($after['emotion'] ?? '');
    $beforeDate = (string) ($before['diary_date'] ?? '');
    $afterDate = (string) ($after['diary_date'] ?? '');
    $beforeDateParam = $beforeDate !== '' ? $beforeDate : null;
    $afterDateParam = $afterDate !== '' ? $afterDate : null;

    $stmt->bind_param(
        'iisssssssssssss',
        $entryId,
        $authorId,
        $authorEmail,
        $authorName,
        $authorUsername,
        $message,
        $beforeTitle,
        $afterTitle,
        $beforeText,
        $afterText,
        $beforeEmotion,
        $afterEmotion,
        $beforeDateParam,
        $afterDateParam,
        $changedFields
    );

    if (!$stmt->execute()) {
        error_log('Commit insert failed: ' . $stmt->error);
        $stmt->close();
        return;
    }
    $stmt->close();

    notify_diary_commit_collaborators($conn, $entryId, $author, $message, $afterTitle);
}

function user_profile(mysqli $conn, string $email): array {
    $email = clean_email($email);
    $stmt = $conn->prepare('SELECT id, username, full_name, email FROM diaryusers WHERE email = ? LIMIT 1');
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    if (!$row) {
        json_response(['status' => 'error', 'message' => 'User account was not found'], 404);
    }
    return $row;
}

function curl_json(string $url, array $options = []): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 25,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_USERAGENT => 'SilentLinesDiary/1.0',
        CURLOPT_HTTPHEADER => $options['headers'] ?? ['Content-Type: application/json'],
    ]);

    if (isset($options['method']) && strtoupper($options['method']) === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($options['body'] ?? []));
    }

    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);

    if ($body === false || $code >= 400) {
        $bodyText = is_string($body) ? trim($body) : '';
        return [
            '_error' => $err ?: "HTTP $code",
            '_http_code' => $code,
            '_body' => $bodyText,
        ];
    }

    $data = json_decode($body, true);
    return is_array($data) ? $data : ['_error' => 'Invalid JSON response'];
}

function env_value(string $name): string {
    $value = getenv($name);
    return is_string($value) ? trim($value) : '';
}

function bind_dynamic(mysqli_stmt $stmt, string $types, array $values): void {
    $refs = [];
    foreach ($values as $key => $value) {
        $refs[$key] = $value;
    }
    $bindArgs = [$types];
    foreach ($refs as $key => &$value) {
        $bindArgs[] = &$value;
    }
    call_user_func_array([$stmt, 'bind_param'], $bindArgs);
}
?>
