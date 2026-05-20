<?php
require_once __DIR__ . '/api_helpers.php';

function diary_lock_mail_secret(string $name, string $fallback = ''): string {
    $value = app_secret($name);
    return $value !== '' ? $value : $fallback;
}

function ensure_diary_lock_table(mysqli $conn): void {
    $conn->query(
        "CREATE TABLE IF NOT EXISTS diary_lock_settings (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id INT NOT NULL,
            is_enabled TINYINT(1) NOT NULL DEFAULT 0,
            password_hash VARCHAR(255) NULL,
            prompt_frequency ENUM('every_visit', 'daily', 'entry_open') NOT NULL DEFAULT 'every_visit',
            recovery_hint VARCHAR(180) NULL,
            last_changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_diary_lock_user (user_id),
            KEY idx_diary_lock_frequency (user_id, prompt_frequency)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $conn->query(
        "CREATE TABLE IF NOT EXISTS diary_lock_reset_logs (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id INT NOT NULL,
            email VARCHAR(190) NOT NULL,
            reset_month CHAR(7) NOT NULL,
            status ENUM('sent', 'blocked', 'failed') NOT NULL DEFAULT 'sent',
            ip_address VARCHAR(45) NULL,
            user_agent VARCHAR(255) NULL,
            message VARCHAR(255) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_diary_lock_reset_user_month (user_id, reset_month, status),
            KEY idx_diary_lock_reset_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $conn->query(
        "CREATE TABLE IF NOT EXISTS diary_lock_attempts (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id INT NOT NULL,
            email VARCHAR(190) NOT NULL,
            ip_address VARCHAR(45) NOT NULL,
            status ENUM('failed', 'success', 'blocked') NOT NULL DEFAULT 'failed',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_diary_lock_attempt_user_ip_time (user_id, ip_address, created_at),
            KEY idx_diary_lock_attempt_user_time (user_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

$method = $_SERVER['REQUEST_METHOD'];
$data = $method === 'GET' ? $_GET : input_json();
$email = clean_email($data['email'] ?? '');
$userId = require_user_id($conn, $email);
$requestPath = substr((string) ($data['path'] ?? ''), 0, 220);
ensure_diary_lock_table($conn);

function current_lock(mysqli $conn, int $userId, string $path = ''): array {
    $stmt = $conn->prepare(
        'SELECT is_enabled, prompt_frequency, recovery_hint, last_changed_at, updated_at
         FROM diary_lock_settings WHERE user_id = ? LIMIT 1'
    );
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    if (!$row) {
        $row = [
            'is_enabled' => 0,
            'prompt_frequency' => 'every_visit',
            'recovery_hint' => '',
            'last_changed_at' => null,
            'updated_at' => null,
        ];
    }
    $row['unlocked'] = diary_lock_cookie_valid($userId, $row, $path) ? 1 : 0;
    return $row;
}

function diary_lock_cookie_name(int $userId): string {
    return 'silentlines_diary_lock_' . $userId;
}

function diary_lock_secret(): string {
    $secret = app_secret('DIARY_LOCK_COOKIE_SECRET');
    return $secret !== '' ? $secret : app_secret('APP_SECRET', 'silentlines-diary-lock-fallback');
}

function diary_lock_cookie_scope(array $settings, string $path): string {
    $frequency = (string) ($settings['prompt_frequency'] ?? 'every_visit');
    $version = (string) ($settings['last_changed_at'] ?? $settings['updated_at'] ?? 'current');
    if ($frequency === 'daily') {
        return $version . ':daily:' . date('Y-m-d');
    }
    if ($frequency === 'entry_open') {
        return $version . ':entry_open:' . $path;
    }
    return $version . ':every_visit';
}

function diary_lock_cookie_value(int $userId, array $settings, string $path): string {
    $scope = diary_lock_cookie_scope($settings, $path);
    $sig = hash_hmac('sha256', $userId . '|' . $scope, diary_lock_secret());
    return base64_encode($scope . '|' . $sig);
}

function diary_lock_cookie_valid(int $userId, array $settings, string $path): bool {
    if ((int) ($settings['is_enabled'] ?? 0) !== 1) {
        return true;
    }
    $cookie = (string) ($_COOKIE[diary_lock_cookie_name($userId)] ?? '');
    if ($cookie === '') {
        return false;
    }
    return hash_equals(diary_lock_cookie_value($userId, $settings, $path), $cookie);
}

function set_diary_lock_cookie(int $userId, array $settings, string $path): void {
    $frequency = (string) ($settings['prompt_frequency'] ?? 'every_visit');
    $expires = 0;
    if ($frequency === 'daily') {
        $expires = strtotime('tomorrow');
    } elseif ($frequency === 'entry_open') {
        $expires = time() + 60 * 60 * 12;
    }
    setcookie(diary_lock_cookie_name($userId), diary_lock_cookie_value($userId, $settings, $path), [
        'expires' => $expires ?: 0,
        'path' => '/',
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function clear_diary_lock_cookie(int $userId): void {
    setcookie(diary_lock_cookie_name($userId), '', [
        'expires' => time() - 3600,
        'path' => '/',
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function random_diary_password(int $length = 12): string {
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    $password = '';
    $max = strlen($alphabet) - 1;

    for ($i = 0; $i < $length; $i++) {
        $password .= $alphabet[random_int(0, $max)];
    }

    return $password;
}

function diary_lock_reset_month(): string {
    return date('Y-m');
}

function diary_lock_reset_count(mysqli $conn, int $userId, string $month): int {
    $stmt = $conn->prepare(
        "SELECT COUNT(*) AS total
         FROM diary_lock_reset_logs
         WHERE user_id = ? AND reset_month = ? AND status = 'sent'"
    );
    $stmt->bind_param('is', $userId, $month);
    $stmt->execute();
    return (int) $stmt->get_result()->fetch_assoc()['total'];
}

function record_diary_lock_reset(mysqli $conn, int $userId, string $email, string $month, string $status, string $message = ''): void {
    $ip = diary_lock_ip();
    $agent = substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255);
    $message = substr($message, 0, 255);

    try {
        $stmt = $conn->prepare(
            'INSERT INTO diary_lock_reset_logs (user_id, email, reset_month, status, ip_address, user_agent, message)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->bind_param('issssss', $userId, $email, $month, $status, $ip, $agent, $message);
        $stmt->execute();
    } catch (Throwable $e) {
        error_log('Diary lock reset log failed: ' . $e->getMessage());
    }
}

function diary_lock_ip(): string {
    foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR'] as $key) {
        $value = trim((string) ($_SERVER[$key] ?? ''));
        if ($value === '') {
            continue;
        }
        $ip = trim(explode(',', $value)[0]);
        if (filter_var($ip, FILTER_VALIDATE_IP)) {
            return substr($ip, 0, 45);
        }
    }
    return 'unknown';
}

function diary_lock_failed_attempt_count(mysqli $conn, int $userId, string $ip): int {
    $stmt = $conn->prepare(
        "SELECT COUNT(*) AS total
         FROM diary_lock_attempts
         WHERE user_id = ? AND ip_address = ? AND status = 'failed' AND created_at >= (NOW() - INTERVAL 24 HOUR)"
    );
    $stmt->bind_param('is', $userId, $ip);
    $stmt->execute();
    return (int) ($stmt->get_result()->fetch_assoc()['total'] ?? 0);
}

function record_diary_lock_attempt(mysqli $conn, int $userId, string $email, string $ip, string $status): void {
    $stmt = $conn->prepare('INSERT INTO diary_lock_attempts (user_id, email, ip_address, status) VALUES (?, ?, ?, ?)');
    if (!$stmt) {
        error_log('Diary lock attempt prepare failed: ' . $conn->error);
        return;
    }
    $stmt->bind_param('isss', $userId, $email, $ip, $status);
    if (!$stmt->execute()) {
        error_log('Diary lock attempt insert failed: ' . $stmt->error);
    }
}

function clear_diary_lock_failures(mysqli $conn, int $userId, string $ip = ''): void {
    if ($ip !== '') {
        $stmt = $conn->prepare("DELETE FROM diary_lock_attempts WHERE user_id = ? AND ip_address = ? AND status = 'failed'");
        $stmt->bind_param('is', $userId, $ip);
    } else {
        $stmt = $conn->prepare("DELETE FROM diary_lock_attempts WHERE user_id = ? AND status = 'failed'");
        $stmt->bind_param('i', $userId);
    }
    $stmt->execute();
}

function send_diary_lock_password_email(string $email, string $password): void {
    $autoloadPath = __DIR__ . '/../../vendor/autoload.php';
    if (!file_exists($autoloadPath)) {
        throw new RuntimeException('Mail service is not installed on the server.');
    }

    require_once $autoloadPath;

    $mail = new PHPMailer\PHPMailer\PHPMailer(true);
    $host = diary_lock_mail_secret('DIARY_SMTP_HOST', diary_lock_mail_secret('SMTP_HOST'));
    $username = diary_lock_mail_secret('DIARY_SMTP_USER', diary_lock_mail_secret('SMTP_USER'));
    $smtpPassword = diary_lock_mail_secret('DIARY_SMTP_PASS', diary_lock_mail_secret('SMTP_PASS'));
    $port = (int) diary_lock_mail_secret('DIARY_SMTP_PORT', diary_lock_mail_secret('SMTP_PORT', '587'));
    $secure = strtolower(diary_lock_mail_secret('DIARY_SMTP_SECURE', diary_lock_mail_secret('SMTP_SECURE', 'tls')));
    $fromEmail = diary_lock_mail_secret('DIARY_MAIL_FROM', diary_lock_mail_secret('SMTP_FROM_EMAIL', $username));
    $fromName = diary_lock_mail_secret('DIARY_MAIL_FROM_NAME', 'SilentLines');

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

    $mail->CharSet = 'UTF-8';
    $mail->setFrom($fromEmail, $fromName);
    $mail->addAddress($email);
    $mail->Subject = 'Your new SilentLines diary password';
    $mail->isHTML(true);
    $mail->Body =
        '<p>Hello,</p>' .
        '<p>You requested a new password for your SilentLines Diary Lock.</p>' .
        '<p><strong>New diary password:</strong> ' . htmlspecialchars($password, ENT_QUOTES, 'UTF-8') . '</p>' .
        '<p>Please sign in and change this password from Settings after you unlock your diary.</p>' .
        '<p>If you did not request this, open SilentLines and set a new diary password immediately.</p>';
    $mail->AltBody = "Hello,\n\nYou requested a new password for your SilentLines Diary Lock.\n\nNew diary password: {$password}\n\nPlease sign in and change this password from Settings after you unlock your diary.\n\nIf you did not request this, open SilentLines and set a new diary password immediately.";
    $mail->send();
}

if ($method === 'GET') {
    json_response(['status' => 'success', 'settings' => current_lock($conn, $userId, $requestPath)]);
}

$action = strtolower(trim($data['action'] ?? 'save'));

if ($action === 'verify') {
    $password = (string) ($data['password'] ?? '');
    $ip = diary_lock_ip();
    $failedCount = diary_lock_failed_attempt_count($conn, $userId, $ip);
    if ($failedCount >= 5) {
        record_diary_lock_attempt($conn, $userId, $email, $ip, 'blocked');
        json_response([
            'status' => 'error',
            'message' => 'Too many wrong diary password attempts. This login is blocked for 24 hours from this IP. Use forgot password to reset your diary password.',
            'locked_until_hours' => 24,
            'failed_attempt_limit' => 5,
        ], 429);
    }

    $stmt = $conn->prepare('SELECT password_hash FROM diary_lock_settings WHERE user_id = ? AND is_enabled = 1 LIMIT 1');
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    if (!$row || !password_verify($password, (string) $row['password_hash'])) {
        record_diary_lock_attempt($conn, $userId, $email, $ip, 'failed');
        $remaining = max(0, 5 - ($failedCount + 1));
        $message = $remaining > 0
            ? "Diary password is incorrect. $remaining attempt" . ($remaining === 1 ? '' : 's') . ' left before a 24 hour lockout.'
            : 'Too many wrong diary password attempts. This login is blocked for 24 hours from this IP. Use forgot password to reset your diary password.';
        json_response([
            'status' => 'error',
            'message' => $message,
            'attempts_remaining' => $remaining,
            'failed_attempt_limit' => 5,
        ], $remaining > 0 ? 401 : 429);
    }
    clear_diary_lock_failures($conn, $userId, $ip);
    record_diary_lock_attempt($conn, $userId, $email, $ip, 'success');
    $verifiedSettings = current_lock($conn, $userId, $requestPath);
    set_diary_lock_cookie($userId, $verifiedSettings, $requestPath);
    $verifiedSettings['unlocked'] = 1;
    json_response(['status' => 'success', 'settings' => $verifiedSettings]);
}

if ($action === 'forgot_password') {
    $resetLimit = 3;
    $resetMonth = diary_lock_reset_month();
    $usedThisMonth = diary_lock_reset_count($conn, $userId, $resetMonth);

    if ($usedThisMonth >= $resetLimit) {
        record_diary_lock_reset($conn, $userId, $email, $resetMonth, 'blocked', 'Monthly reset limit reached');
        json_response([
            'status' => 'error',
            'message' => 'You can reset your diary password only 3 times in a month. You have used all 3 resets for this month.',
            'reset_limit' => $resetLimit,
            'resets_used' => $usedThisMonth,
            'resets_remaining' => 0,
            'reset_month' => $resetMonth,
        ], 429);
    }

    $newPassword = random_diary_password();
    $hash = password_hash($newPassword, PASSWORD_DEFAULT);

    try {
        $conn->begin_transaction();
        $existing = current_lock($conn, $userId, $requestPath);
        $frequency = (string) ($existing['prompt_frequency'] ?? 'every_visit');
        if (!in_array($frequency, ['every_visit', 'daily', 'entry_open'], true)) {
            $frequency = 'every_visit';
        }
        $hint = substr(trim((string) ($existing['recovery_hint'] ?? '')), 0, 180);
        $enabled = 1;

        $stmt = $conn->prepare(
            'INSERT INTO diary_lock_settings (user_id, is_enabled, password_hash, prompt_frequency, recovery_hint, last_changed_at)
             VALUES (?, ?, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE is_enabled = VALUES(is_enabled), password_hash = VALUES(password_hash),
             prompt_frequency = VALUES(prompt_frequency), recovery_hint = VALUES(recovery_hint), last_changed_at = NOW()'
        );
        $stmt->bind_param('iisss', $userId, $enabled, $hash, $frequency, $hint);
        if (!$stmt->execute()) {
            throw new RuntimeException('Could not reset diary lock password.');
        }

        send_diary_lock_password_email($email, $newPassword);
        record_diary_lock_reset($conn, $userId, $email, $resetMonth, 'sent', 'New diary password emailed');
        clear_diary_lock_failures($conn, $userId);
        clear_diary_lock_cookie($userId);
        $conn->commit();
    } catch (Throwable $e) {
        try {
            $conn->rollback();
        } catch (Throwable $rollbackError) {
            error_log('Diary lock reset rollback failed: ' . $rollbackError->getMessage());
        }
        error_log('Diary lock reset failed: ' . $e->getMessage());
        record_diary_lock_reset($conn, $userId, $email, $resetMonth, 'failed', 'Email send or password reset failed');
        json_response([
            'status' => 'error',
            'message' => 'Could not send a new diary password right now. Please try again later.',
            'reset_limit' => $resetLimit,
            'resets_used' => $usedThisMonth,
            'resets_remaining' => max(0, $resetLimit - $usedThisMonth),
            'reset_month' => $resetMonth,
        ], 500);
    }

    $newUsedThisMonth = $usedThisMonth + 1;
    json_response([
        'status' => 'success',
        'message' => 'A new diary password has been sent to your registered email. You can use forgot password 3 times per month.',
        'settings' => current_lock($conn, $userId, $requestPath),
        'reset_limit' => $resetLimit,
        'resets_used' => $newUsedThisMonth,
        'resets_remaining' => max(0, $resetLimit - $newUsedThisMonth),
        'reset_month' => $resetMonth,
    ]);
}

$enabled = (int) !empty($data['is_enabled']);
$frequency = (string) ($data['prompt_frequency'] ?? 'every_visit');
if (!in_array($frequency, ['every_visit', 'daily', 'entry_open'], true)) {
    $frequency = 'every_visit';
}
$hint = substr(trim((string) ($data['recovery_hint'] ?? '')), 0, 180);
$password = (string) ($data['password'] ?? '');

if ($enabled && strlen($password) < 4) {
    $existing = current_lock($conn, $userId);
    $hasExisting = (int) ($existing['is_enabled'] ?? 0) === 1;
    if (!$hasExisting) {
        json_response(['status' => 'error', 'message' => 'Choose a diary password with at least 4 characters'], 400);
    }
}

if ($password !== '') {
    if (strlen($password) < 4) {
        json_response(['status' => 'error', 'message' => 'Choose a diary password with at least 4 characters'], 400);
    }
    $hash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $conn->prepare(
        'INSERT INTO diary_lock_settings (user_id, is_enabled, password_hash, prompt_frequency, recovery_hint, last_changed_at)
         VALUES (?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE is_enabled = VALUES(is_enabled), password_hash = VALUES(password_hash),
         prompt_frequency = VALUES(prompt_frequency), recovery_hint = VALUES(recovery_hint), last_changed_at = NOW()'
    );
    $stmt->bind_param('iisss', $userId, $enabled, $hash, $frequency, $hint);
} else {
    $stmt = $conn->prepare(
        'INSERT INTO diary_lock_settings (user_id, is_enabled, prompt_frequency, recovery_hint)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE is_enabled = VALUES(is_enabled),
         prompt_frequency = VALUES(prompt_frequency), recovery_hint = VALUES(recovery_hint)'
    );
    $stmt->bind_param('iiss', $userId, $enabled, $frequency, $hint);
}

if (!$stmt->execute()) {
    json_response(['status' => 'error', 'message' => 'Could not save diary lock settings'], 500);
}

clear_diary_lock_cookie($userId);
json_response(['status' => 'success', 'settings' => current_lock($conn, $userId, $requestPath)]);
?>
