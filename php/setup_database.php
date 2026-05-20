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
header('Access-Control-Allow-Methods: POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    echo json_encode(['status' => 'ok']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'POST request required.']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
if (!is_array($data) || ($data['confirm'] ?? '') !== 'create-local-database') {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Explicit local setup confirmation is required.']);
    exit;
}

try {
    $result = setup_create_database_and_tables();
    echo json_encode([
        'status' => 'success',
        'message' => 'Local database and tables are ready.',
        'database' => $result['database'],
        'tables' => $result['tables'],
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Could not create the local database. Check MySQL permissions and php/secrets.php.',
    ]);
}
?>
