<?php
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

$secretsPath = __DIR__ . '/secrets.php';
if (file_exists($secretsPath)) {
    require_once $secretsPath;
}

function diary_config_value(string $name, string $fallback): string {
    $value = getenv($name);
    if (is_string($value) && $value !== '') {
        return $value;
    }
    if (defined($name)) {
        $constantValue = constant($name);
        return is_string($constantValue) ? $constantValue : $fallback;
    }
    return $fallback;
}

$dbHost = diary_config_value('DIARY_DB_HOST', 'localhost');
$dbUser = diary_config_value('DIARY_DB_USER', 'root');
$dbPass = diary_config_value('DIARY_DB_PASS', '');
$dbName = diary_config_value('DIARY_DB_NAME', 'silentlinesdiary');

try {
    $conn = new mysqli($dbHost, $dbUser, $dbPass, $dbName);
    $conn->set_charset('utf8mb4');
} catch (Throwable $e) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['status' => 'error', 'message' => 'Database connection failed']);
    exit;
}
?>
