<?php
require_once __DIR__ . '/setup_schema.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

if (!setup_is_local_request()) {
    http_response_code(403);
    echo json_encode(['status' => 'error', 'message' => 'Database setup is only available from localhost.']);
    exit;
}

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '') {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Credentials: true');
}
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: GET, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    echo json_encode(['status' => 'ok']);
    exit;
}

$status = setup_database_exists();
echo json_encode([
    'status' => $status['ok'] ? 'success' : 'error',
    'database' => $status['database'],
    'exists' => $status['exists'],
    'message' => $status['ok'] ? '' : 'Local MySQL connection failed. Check php/secrets.php or your MySQL service.',
]);
?>
