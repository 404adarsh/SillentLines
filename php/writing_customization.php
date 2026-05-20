<?php
require_once __DIR__ . '/api_helpers.php';

function ensure_writing_customization_table(mysqli $conn): void {
    $conn->query(
        "CREATE TABLE IF NOT EXISTS diary_writing_customizations (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id INT NOT NULL,
            settings_json MEDIUMTEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_writing_customization_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

function default_writing_customization(): array {
    return [
        'brand_name' => 'SilentLines',
        'logo_image' => '',
        'code_mode' => false,
        'ai_enabled' => true,
        'ai_blocked' => false,
        'accessibility_labels' => true,
        'navigation_assistant' => true,
        'menu_shortcuts' => ['home', 'profile', 'write', 'notes', 'archive', 'daily', 'people', 'settings', 'contact'],
        'effects' => [],
        'stickers' => [],
        'buttons' => [
            ['id' => 'save', 'label' => 'Save', 'visible' => true, 'required' => true],
            ['id' => 'image', 'label' => 'Image', 'visible' => true, 'required' => false],
            ['id' => 'code', 'label' => 'Code', 'visible' => true, 'required' => false],
            ['id' => 'burn', 'label' => 'Burn', 'visible' => true, 'required' => false],
            ['id' => 'share', 'label' => 'Share', 'visible' => true, 'required' => false],
            ['id' => 'commits', 'label' => 'Commits', 'visible' => true, 'required' => false],
            ['id' => 'reset', 'label' => 'Reset Layout', 'visible' => true, 'required' => true],
        ],
    ];
}

function normalize_writing_customization(array $settings): array {
    $default = default_writing_customization();
    $allowed = [];
    foreach ($default['buttons'] as $button) {
        $allowed[$button['id']] = $button;
    }
    $allowedEffects = ['paper', 'sparkle', 'glow', 'rain', 'night'];
    $allowedStickers = ['star', 'heart', 'note', 'spark', 'moon', 'flower'];
    $allowedMenuShortcuts = ['home', 'profile', 'write', 'notes', 'archive', 'daily', 'people', 'trade', 'portfolio', 'accounts', 'programming', 'calendar', 'tutorial', 'safety', 'contact', 'settings'];

    $ordered = [];
    foreach (($settings['buttons'] ?? []) as $button) {
        $id = (string) ($button['id'] ?? '');
        if (!isset($allowed[$id]) || isset($ordered[$id])) {
            continue;
        }
        $required = !empty($allowed[$id]['required']);
        $ordered[$id] = [
            'id' => $id,
            'label' => $allowed[$id]['label'],
            'visible' => $required ? true : !empty($button['visible']),
            'required' => $required,
        ];
    }

    foreach ($allowed as $id => $button) {
        if (!isset($ordered[$id])) {
            $ordered[$id] = $button;
        }
    }

    $filterList = function ($items, $allowedItems) {
        $out = [];
        foreach ((array) $items as $item) {
            $item = trim((string) $item);
            if ($item === '' || !in_array($item, $allowedItems, true) || in_array($item, $out, true)) {
                continue;
            }
            $out[] = $item;
        }
        return $out;
    };

    return [
        'brand_name' => substr(trim((string) ($settings['brand_name'] ?? 'SilentLines')), 0, 60) ?: 'SilentLines',
        'logo_image' => substr((string) ($settings['logo_image'] ?? ''), 0, 750000),
        'code_mode' => !empty($settings['code_mode']),
        'ai_enabled' => array_key_exists('ai_enabled', $settings) ? !empty($settings['ai_enabled']) : true,
        'ai_blocked' => !empty($settings['ai_blocked']),
        'accessibility_labels' => array_key_exists('accessibility_labels', $settings) ? !empty($settings['accessibility_labels']) : true,
        'navigation_assistant' => array_key_exists('navigation_assistant', $settings) ? !empty($settings['navigation_assistant']) : true,
        'menu_shortcuts' => $filterList($settings['menu_shortcuts'] ?? $default['menu_shortcuts'], $allowedMenuShortcuts),
        'effects' => $filterList($settings['effects'] ?? [], $allowedEffects),
        'stickers' => $filterList($settings['stickers'] ?? [], $allowedStickers),
        'buttons' => array_values($ordered),
    ];
}

$method = $_SERVER['REQUEST_METHOD'];
$data = $method === 'GET' ? $_GET : input_json();
$email = clean_email($data['email'] ?? $data['user_email'] ?? '');
$userId = require_user_id($conn, $email);
ensure_writing_customization_table($conn);

if ($method === 'GET') {
    $stmt = $conn->prepare('SELECT settings_json FROM diary_writing_customizations WHERE user_id = ? LIMIT 1');
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $settings = $row ? json_decode((string) $row['settings_json'], true) : [];
    json_response(['status' => 'success', 'customization' => normalize_writing_customization(is_array($settings) ? $settings : [])]);
}

$action = strtolower(trim((string) ($data['action'] ?? 'save')));
$settings = $action === 'reset'
    ? default_writing_customization()
    : normalize_writing_customization(is_array($data['customization'] ?? null) ? $data['customization'] : []);
$json = json_encode($settings);

$stmt = $conn->prepare(
    'INSERT INTO diary_writing_customizations (user_id, settings_json)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE settings_json = VALUES(settings_json)'
);
$stmt->bind_param('is', $userId, $json);
if (!$stmt->execute()) {
    json_response(['status' => 'error', 'message' => 'Could not save writing customization'], 500);
}

json_response([
    'status' => 'success',
    'message' => $action === 'reset' ? 'Writing customization reset.' : 'Writing customization saved.',
    'customization' => $settings,
]);
?>
