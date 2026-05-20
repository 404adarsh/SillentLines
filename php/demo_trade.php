<?php
require_once __DIR__ . '/api_helpers.php';

$asset = strtoupper(trim($_GET['asset'] ?? 'BTC'));
$symbolMap = [
    'BTC' => 'BTCUSDT',
    'BITCOIN' => 'BTCUSDT',
    'ETH' => 'ETHUSDT',
    'ETHEREUM' => 'ETHUSDT',
    'SOL' => 'SOLUSDT',
    'SOLANA' => 'SOLUSDT',
    'BNB' => 'BNBUSDT',
    'XRP' => 'XRPUSDT',
    'DOGE' => 'DOGEUSDT',
    'ADA' => 'ADAUSDT',
    'MATIC' => 'MATICUSDT',
    'POL' => 'POLUSDT',
    'AVAX' => 'AVAXUSDT',
    'LINK' => 'LINKUSDT',
];
$symbol = $symbolMap[$asset] ?? preg_replace('/[^A-Z0-9]/', '', $asset);
if ($symbol !== '' && substr($symbol, -4) !== 'USDT') {
    $symbol .= 'USDT';
}
if ($symbol === '') {
    json_response(['status' => 'error', 'message' => 'Asset is required'], 400);
}

$market = curl_json('https://api.binance.com/api/v3/klines?symbol=' . urlencode($symbol) . '&interval=1d&limit=30', [
    'headers' => ['Accept: application/json', 'User-Agent: SilentLinesTrader/1.0'],
]);

$prices = [];
if (!isset($market['_error']) && is_array($market) && isset($market[0]) && is_array($market[0])) {
    foreach ($market as $candle) {
        $prices[] = [
            'time' => (int) ((int) $candle[0] / 1000),
            'price' => (float) $candle[4],
        ];
    }
}

if (empty($prices)) {
    json_response([
        'status' => 'error',
        'message' => 'Free market data is available for BTC, ETH, SOL, BNB, XRP, DOGE, ADA, AVAX, LINK, and other Binance USDT symbols. Try BTC or ETH.',
    ], 400);
}

$count = count($prices);
$latest = $prices[$count - 1]['price'];
$previous = $prices[max(0, $count - 2)]['price'];
$first = $prices[0]['price'];
$last7 = array_slice($prices, -7);
$avg7 = array_sum(array_column($last7, 'price')) / max(count($last7), 1);
$change30 = $first > 0 ? (($latest - $first) / $first) * 100 : 0;
$change24 = $previous > 0 ? (($latest - $previous) / $previous) * 100 : 0;

$bias = 'Watchlist';
$idea = 'Wait for a cleaner setup. Journal the level where your idea becomes invalid.';
if ($latest > $avg7 && $change24 > 0) {
    $bias = 'Momentum demo';
    $idea = 'Demo idea: consider a paper buy only if price stays above the 7-day average. Risk should be pre-defined before entry.';
} elseif ($latest < $avg7 && $change24 < 0) {
    $bias = 'Pullback demo';
    $idea = 'Demo idea: avoid chasing. Wait for stabilization near support and write why buyers may return.';
}

json_response([
    'status' => 'success',
    'asset' => $symbol,
    'latest_price' => round($latest, 2),
    'latest_price_inr' => round($latest, 2),
    'avg_7d' => round($avg7, 2),
    'avg_7d_inr' => round($avg7, 2),
    'currency' => 'USDT',
    'change_24h_percent' => round($change24, 2),
    'change_30d_percent' => round($change30, 2),
    'bias' => $bias,
    'idea' => $idea,
    'prices' => array_map(function ($point) {
        return [
            'date' => date('Y-m-d', $point['time']),
            'price' => round($point['price'], 2),
        ];
    }, $prices),
]);
?>
