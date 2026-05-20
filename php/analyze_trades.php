<?php
require_once __DIR__ . '/api_helpers.php';

$data = input_json();
$email = clean_email($data['email'] ?? '');
$userId = require_user_id($conn, $email);

$trades = [];
if (table_exists($conn, 'trades')) {
    $tradeStmt = $conn->prepare(
        'SELECT asset, trade_type, buy_price, sell_price, trade_date
         FROM trades WHERE user_id = ? ORDER BY trade_date DESC LIMIT 25'
    );
    $tradeStmt->bind_param('i', $userId);
    $tradeStmt->execute();
    $trades = $tradeStmt->get_result()->fetch_all(MYSQLI_ASSOC);
}

$table = diary_table($conn);
$textColumn = column_exists($conn, $table, 'entry_text') ? 'entry_text' : 'entry';
$userColumn = column_exists($conn, $table, 'user_id') ? 'user_id' : '';
$entries = [];

if ($userColumn !== '') {
    $sql = "SELECT $textColumn AS entry_text, created_at FROM $table WHERE user_id = ? ORDER BY created_at DESC LIMIT 15";
    $entryStmt = $conn->prepare($sql);
    $entryStmt->bind_param('i', $userId);
    $entryStmt->execute();
    $entries = $entryStmt->get_result()->fetch_all(MYSQLI_ASSOC);
}

$prompt = "You are a concise trading journal coach for an Indian user. Review diary entries and trade data. If there are no trades yet, say that clearly and give a starter plan for logging trades, risk, and ideas. Give short bullets: progress, repeated mistakes, risk-management suggestions, and one next action. Do not provide financial guarantees.\n\nTrades:\n" .
    json_encode($trades, JSON_PRETTY_PRINT) . "\n\nDiary entries:\n" . json_encode($entries, JSON_PRETTY_PRINT);

$sarvamKey = app_secret('SARVAM_API_KEY');
$provider = 'sarvam';

if ($sarvamKey !== '') {
    $ai = curl_json('https://api.sarvam.ai/v1/chat/completions', [
        'method' => 'POST',
        'headers' => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $sarvamKey,
            'api-subscription-key: ' . $sarvamKey,
        ],
        'body' => [
            'model' => app_secret('SARVAM_MODEL') ?: 'sarvam-30b',
            'messages' => [
                ['role' => 'system', 'content' => 'You are a helpful trading progress and idea coach. Keep responses simple, practical, and safe.'],
                ['role' => 'user', 'content' => $prompt],
            ],
            'temperature' => 0.2,
            'max_tokens' => 500,
        ],
    ]);
} else {
    $provider = 'openai';
    $openAiKey = app_secret('OPENAI_API_KEY');
    if ($openAiKey === '') {
        json_response(['status' => 'error', 'message' => 'SARVAM_API_KEY or OPENAI_API_KEY is not configured on the server'], 500);
    }

    $ai = curl_json('https://api.openai.com/v1/chat/completions', [
        'method' => 'POST',
        'headers' => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $openAiKey,
        ],
        'body' => [
            'model' => app_secret('OPENAI_MODEL') ?: 'gpt-4o-mini',
            'messages' => [
                ['role' => 'developer', 'content' => 'You are a helpful trading psychology assistant. Keep responses simple and safe.'],
                ['role' => 'user', 'content' => $prompt],
            ],
            'temperature' => 0.3,
            'max_completion_tokens' => 450,
        ],
    ]);
}

if (isset($ai['_error'])) {
    json_response(['status' => 'error', 'message' => strtoupper($provider) . ' analysis request failed'], 502);
}

$feedback = trim($ai['choices'][0]['message']['content'] ?? '');
if ($feedback === '') {
    $feedback = "You have not logged enough trade data yet. Start with this simple plan:\n\n" .
        "- Write one market idea before taking any trade: asset, reason, risk, and invalidation level.\n" .
        "- Keep every position small until your journal shows repeatable discipline.\n" .
        "- After each trade, record what happened versus what you expected.\n" .
        "- For commerce practice, track capital, cash flow, risk, and decision quality, not only profit.\n" .
        "- Next action: create one demo trade journal entry today and review it after 24 hours.";
}
json_response(['status' => 'success', 'feedback' => $feedback, 'provider' => $provider]);
?>
