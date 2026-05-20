<?php
require_once __DIR__ . '/api_helpers.php';

$method = $_SERVER['REQUEST_METHOD'];
$data = $method === 'GET' ? $_GET : input_json();
$email = clean_email($data['email'] ?? $data['user_email'] ?? '');
$userId = require_user_id($conn, $email);
$action = strtolower(trim((string) ($data['action'] ?? 'get')));

try {
    ensure_diary_email_preference_tables($conn);
} catch (Throwable $e) {
    error_log('Email preference schema check failed: ' . $e->getMessage());
    if ($action === 'get') {
        json_response(default_email_preference_payload());
    }
    json_response(['status' => 'error', 'message' => 'Email preferences are temporarily unavailable.'], 503);
}

if ($action === 'save') {
    $disableAll = !empty($data['disable_all']) ? 1 : 0;
    $allowOnly = !empty($data['allow_only_selected_senders']) ? 1 : 0;
    $stmt = $conn->prepare(
        'INSERT INTO diary_email_preferences (user_id, disable_all, allow_only_selected_senders)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE disable_all = VALUES(disable_all), allow_only_selected_senders = VALUES(allow_only_selected_senders)'
    );
    $stmt->bind_param('iii', $userId, $disableAll, $allowOnly);
    if (!$stmt->execute()) {
        json_response(['status' => 'error', 'message' => 'Could not save email preferences'], 500);
    }
    respond_email_preference_payload($conn, $userId, $action);
}

if ($action === 'mute_entry') {
    $entryId = (int) ($data['entry_id'] ?? 0);
    if ($entryId <= 0) {
        json_response(['status' => 'error', 'message' => 'Entry id is required'], 400);
    }
    $stmt = $conn->prepare(
        'INSERT INTO diary_email_entry_mutes (user_id, entry_id)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE created_at = created_at'
    );
    $stmt->bind_param('ii', $userId, $entryId);
    if (!$stmt->execute()) {
        json_response(['status' => 'error', 'message' => 'Could not mute this diary entry'], 500);
    }
    respond_email_preference_payload($conn, $userId, $action);
}

if ($action === 'unmute_entry') {
    $entryId = (int) ($data['entry_id'] ?? 0);
    $stmt = $conn->prepare('DELETE FROM diary_email_entry_mutes WHERE user_id = ? AND entry_id = ?');
    $stmt->bind_param('ii', $userId, $entryId);
    $stmt->execute();
    respond_email_preference_payload($conn, $userId, $action);
}

if ($action === 'add_sender') {
    $senderId = (int) ($data['sender_user_id'] ?? $data['user_id'] ?? 0);
    if ($senderId <= 0 || $senderId === $userId) {
        json_response(['status' => 'error', 'message' => 'Choose another user to allow'], 400);
    }
    $find = $conn->prepare('SELECT id FROM diaryusers WHERE id = ? LIMIT 1');
    $find->bind_param('i', $senderId);
    $find->execute();
    if (!$find->get_result()->fetch_assoc()) {
        json_response(['status' => 'error', 'message' => 'User was not found'], 404);
    }
    $stmt = $conn->prepare(
        'INSERT INTO diary_email_sender_allowlist (user_id, sender_user_id)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE created_at = created_at'
    );
    $stmt->bind_param('ii', $userId, $senderId);
    if (!$stmt->execute()) {
        json_response(['status' => 'error', 'message' => 'Could not allow this sender'], 500);
    }
    respond_email_preference_payload($conn, $userId, $action);
}

if ($action === 'remove_sender') {
    $senderId = (int) ($data['sender_user_id'] ?? 0);
    $stmt = $conn->prepare('DELETE FROM diary_email_sender_allowlist WHERE user_id = ? AND sender_user_id = ?');
    $stmt->bind_param('ii', $userId, $senderId);
    $stmt->execute();
    respond_email_preference_payload($conn, $userId, $action);
}

try {
    respond_email_preference_payload($conn, $userId, $action);
} catch (Throwable $e) {
    error_log('Email preference payload failed: ' . $e->getMessage());
    if ($action === 'get') {
        json_response(default_email_preference_payload());
    }
    json_response(['status' => 'error', 'message' => 'Email preferences are temporarily unavailable.'], 503);
}

function default_email_preference_payload(): array {
    return [
        'status' => 'success',
        'preferences' => [
            'disable_all' => 0,
            'allow_only_selected_senders' => 0,
        ],
        'muted_entries' => [],
        'allowed_senders' => [],
        'email_preferences_available' => false,
    ];
}

function respond_email_preference_payload(mysqli $conn, int $userId, string $action): void {
    try {
        json_response(email_preference_payload($conn, $userId));
    } catch (Throwable $e) {
        error_log('Email preference payload failed: ' . $e->getMessage());
        if ($action === 'get') {
            json_response(default_email_preference_payload());
        }
        json_response(['status' => 'error', 'message' => 'Email preferences are temporarily unavailable.'], 503);
    }
}

function email_preference_payload(mysqli $conn, int $userId): array {
    $prefStmt = $conn->prepare('SELECT disable_all, allow_only_selected_senders FROM diary_email_preferences WHERE user_id = ? LIMIT 1');
    $prefStmt->bind_param('i', $userId);
    $prefStmt->execute();
    $prefs = $prefStmt->get_result()->fetch_assoc() ?: ['disable_all' => 0, 'allow_only_selected_senders' => 0];

    $muteStmt = $conn->prepare(
        "SELECT m.entry_id, CONCAT('Diary entry #', m.entry_id) AS title
         FROM diary_email_entry_mutes m
         WHERE m.user_id = ?
         ORDER BY m.created_at DESC"
    );
    $muteStmt->bind_param('i', $userId);
    $muteStmt->execute();

    $senderStmt = $conn->prepare(
        'SELECT u.id, u.email, u.username, u.full_name
         FROM diary_email_sender_allowlist a
         INNER JOIN diaryusers u ON u.id = a.sender_user_id
         WHERE a.user_id = ?
         ORDER BY a.created_at DESC'
    );
    $senderStmt->bind_param('i', $userId);
    $senderStmt->execute();

    return [
        'status' => 'success',
        'preferences' => [
            'disable_all' => (int) ($prefs['disable_all'] ?? 0),
            'allow_only_selected_senders' => (int) ($prefs['allow_only_selected_senders'] ?? 0),
        ],
        'muted_entries' => $muteStmt->get_result()->fetch_all(MYSQLI_ASSOC) ?: [],
        'allowed_senders' => $senderStmt->get_result()->fetch_all(MYSQLI_ASSOC) ?: [],
    ];
}
?>
