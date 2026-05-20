<?php
require_once __DIR__ . '/api_helpers.php';

function ensure_preferences_table(mysqli $conn): void {
    $conn->query(
        "CREATE TABLE IF NOT EXISTS user_preferences (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id INT NOT NULL,
            use_personal TINYINT(1) NOT NULL DEFAULT 0,
            use_trading TINYINT(1) NOT NULL DEFAULT 0,
            use_accounting TINYINT(1) NOT NULL DEFAULT 0,
            use_commerce TINYINT(1) NOT NULL DEFAULT 0,
            use_programming TINYINT(1) NOT NULL DEFAULT 0,
            experience_level VARCHAR(32) NOT NULL DEFAULT 'beginner',
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_user_preferences (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    if (!column_exists($conn, 'user_preferences', 'use_programming')) {
        $conn->query("ALTER TABLE user_preferences ADD COLUMN use_programming TINYINT(1) NOT NULL DEFAULT 0 AFTER use_commerce");
    }
}

$method = $_SERVER['REQUEST_METHOD'];
$data = $method === 'GET' ? $_GET : input_json();
$email = clean_email($data['email'] ?? '');
$userId = require_user_id($conn, $email);
ensure_preferences_table($conn);

if ($method === 'GET') {
    $stmt = $conn->prepare('SELECT use_personal, use_trading, use_accounting, use_commerce, use_programming, experience_level FROM user_preferences WHERE user_id = ? LIMIT 1');
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $prefs = $stmt->get_result()->fetch_assoc();
    json_response(['status' => 'success', 'preferences' => $prefs, 'has_preferences' => (bool) $prefs]);
}

$personal = !empty($data['use_personal']) ? 1 : 0;
$trading = !empty($data['use_trading']) ? 1 : 0;
$accounting = !empty($data['use_accounting']) ? 1 : 0;
$commerce = !empty($data['use_commerce']) ? 1 : 0;
$programming = !empty($data['use_programming']) ? 1 : 0;
$level = preg_replace('/[^a-z_ -]/i', '', $data['experience_level'] ?? 'beginner') ?: 'beginner';

if (!$personal && !$trading && !$accounting && !$commerce && !$programming) {
    $personal = 1;
}

$stmt = $conn->prepare(
    'INSERT INTO user_preferences (user_id, use_personal, use_trading, use_accounting, use_commerce, use_programming, experience_level)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
        use_personal = VALUES(use_personal),
        use_trading = VALUES(use_trading),
        use_accounting = VALUES(use_accounting),
        use_commerce = VALUES(use_commerce),
        use_programming = VALUES(use_programming),
        experience_level = VALUES(experience_level)'
);
$stmt->bind_param('iiiiiis', $userId, $personal, $trading, $accounting, $commerce, $programming, $level);
$stmt->execute();

json_response([
    'status' => 'success',
    'preferences' => [
        'use_personal' => $personal,
        'use_trading' => $trading,
        'use_accounting' => $accounting,
        'use_commerce' => $commerce,
        'use_programming' => $programming,
        'experience_level' => $level,
    ],
]);
?>
