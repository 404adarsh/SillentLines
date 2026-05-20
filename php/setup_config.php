<?php
require_once __DIR__ . '/setup_schema.php';

$existingSecrets = __DIR__ . '/secrets.php';
if (file_exists($existingSecrets)) {
    require_once $existingSecrets;
}

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

if (!setup_is_local_request()) {
    http_response_code(403);
    echo json_encode(['status' => 'error', 'message' => 'Local config setup is only available from localhost.']);
    exit;
}

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '') {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Credentials: true');
}
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    echo json_encode(['status' => 'ok']);
    exit;
}

$secretNames = [
    'DIARY_DB_HOST' => 'localhost',
    'DIARY_DB_USER' => 'root',
    'DIARY_DB_PASS' => '',
    'DIARY_DB_NAME' => 'silentlinesdiary',
    'AUTH0_DOMAIN' => '',
    'AUTH0_CLIENT_ID' => '',
    'ALCHEMY_API_KEY' => '',
    'SARVAM_API_KEY' => '',
    'SARVAM_MODEL' => 'sarvam-30b',
    'OPENAI_API_KEY' => '',
    'OPENAI_MODEL' => 'gpt-4o-mini',
    'DIARY_SMTP_HOST' => '',
    'DIARY_SMTP_PORT' => '587',
    'DIARY_SMTP_SECURE' => 'tls',
    'DIARY_SMTP_USER' => '',
    'DIARY_SMTP_PASS' => '',
    'DIARY_MAIL_FROM' => '',
    'DIARY_MAIL_FROM_NAME' => 'SilentLines',
];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    echo json_encode([
        'status' => 'success',
        'configured' => [
            'auth0' => setup_secret_value('AUTH0_DOMAIN') !== '' && setup_secret_value('AUTH0_CLIENT_ID') !== '',
            'alchemy_api_key' => setup_secret_value('ALCHEMY_API_KEY') !== '',
            'sarvam_api_key' => setup_secret_value('SARVAM_API_KEY') !== '',
            'openai_api_key' => setup_secret_value('OPENAI_API_KEY') !== '',
            'smtp' => setup_secret_value('DIARY_SMTP_HOST') !== '' && setup_secret_value('DIARY_SMTP_USER') !== '',
        ],
        'config' => [
            'auth0_domain' => setup_secret_value('AUTH0_DOMAIN'),
            'auth0_client_id' => setup_secret_value('AUTH0_CLIENT_ID'),
            'alchemy_api_key' => setup_secret_value('ALCHEMY_API_KEY'),
            'sarvam_api_key' => setup_secret_value('SARVAM_API_KEY'),
            'sarvam_model' => setup_secret_value('SARVAM_MODEL'),
            'openai_api_key' => setup_secret_value('OPENAI_API_KEY'),
            'openai_model' => setup_secret_value('OPENAI_MODEL'),
            'diary_smtp_host' => setup_secret_value('DIARY_SMTP_HOST'),
            'diary_smtp_port' => setup_secret_value('DIARY_SMTP_PORT'),
            'diary_smtp_secure' => setup_secret_value('DIARY_SMTP_SECURE'),
            'diary_smtp_user' => setup_secret_value('DIARY_SMTP_USER'),
            'diary_smtp_pass' => setup_secret_value('DIARY_SMTP_PASS'),
            'diary_mail_from' => setup_secret_value('DIARY_MAIL_FROM'),
            'diary_mail_from_name' => setup_secret_value('DIARY_MAIL_FROM_NAME'),
        ],
    ]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'POST request required.']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'JSON body is required.']);
    exit;
}

$inputMap = [
    'auth0_domain' => 'AUTH0_DOMAIN',
    'auth0_client_id' => 'AUTH0_CLIENT_ID',
    'alchemy_api_key' => 'ALCHEMY_API_KEY',
    'sarvam_api_key' => 'SARVAM_API_KEY',
    'sarvam_model' => 'SARVAM_MODEL',
    'openai_api_key' => 'OPENAI_API_KEY',
    'openai_model' => 'OPENAI_MODEL',
    'diary_smtp_host' => 'DIARY_SMTP_HOST',
    'diary_smtp_port' => 'DIARY_SMTP_PORT',
    'diary_smtp_secure' => 'DIARY_SMTP_SECURE',
    'diary_smtp_user' => 'DIARY_SMTP_USER',
    'diary_smtp_pass' => 'DIARY_SMTP_PASS',
    'diary_mail_from' => 'DIARY_MAIL_FROM',
    'diary_mail_from_name' => 'DIARY_MAIL_FROM_NAME',
];

$values = [];
foreach ($secretNames as $name => $fallback) {
    $values[$name] = setup_secret_value($name, $fallback);
}

foreach ($inputMap as $inputName => $constantName) {
    if (array_key_exists($inputName, $data)) {
        $nextValue = trim((string) $data[$inputName]);
        if ($nextValue !== '') {
            $values[$constantName] = $nextValue;
        }
    }
}

$contents = "<?php\n";
$contents .= "// Local development secrets. Do not commit this file.\n";
foreach ($values as $name => $value) {
    $contents .= "define('" . $name . "', " . var_export($value, true) . ");\n";
}
$contents .= "?>\n";

$target = __DIR__ . '/secrets.php';
if (file_put_contents($target, $contents, LOCK_EX) === false) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Could not write php/secrets.php. Check file permissions.']);
    exit;
}

echo json_encode(['status' => 'success', 'message' => 'Local backend config saved.']);

function setup_secret_value(string $name, string $fallback = ''): string {
    $env = getenv($name);
    if (is_string($env) && $env !== '') {
        return $env;
    }
    if (defined($name)) {
        $value = constant($name);
        return is_string($value) ? $value : $fallback;
    }
    return $fallback;
}
?>
