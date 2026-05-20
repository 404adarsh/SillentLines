<?php
require_once __DIR__ . '/api_helpers.php';

$address = clean_eth_address($_GET['address'] ?? '');
$email = clean_email($_GET['email'] ?? '');
$userId = require_user_id($conn, $email);

$saved = $conn->prepare('SELECT id FROM user_wallets WHERE user_id = ? AND wallet_address = ? LIMIT 1');
$saved->bind_param('is', $userId, $address);
$saved->execute();
if (!$saved->get_result()->fetch_assoc()) {
    json_response(['status' => 'error', 'message' => 'Wallet is not linked to this account'], 403);
}

$alchemyKey = app_secret('ALCHEMY_API_KEY');
if ($alchemyKey === '') {
    json_response(['status' => 'error', 'message' => 'ALCHEMY_API_KEY is not configured on the server'], 500);
}

$alchemyUrl = "https://eth-mainnet.g.alchemy.com/v2/$alchemyKey";

$ethBalance = curl_json($alchemyUrl, [
    'method' => 'POST',
    'body' => [
        'jsonrpc' => '2.0',
        'id' => 1,
        'method' => 'eth_getBalance',
        'params' => [$address, 'latest'],
    ],
]);

$tokenBalances = curl_json($alchemyUrl, [
    'method' => 'POST',
    'body' => [
        'jsonrpc' => '2.0',
        'id' => 2,
        'method' => 'alchemy_getTokenBalances',
        'params' => [$address, 'erc20'],
    ],
]);

$incomingTransfers = curl_json($alchemyUrl, [
    'method' => 'POST',
    'body' => [
        'jsonrpc' => '2.0',
        'id' => 3,
        'method' => 'alchemy_getAssetTransfers',
        'params' => [[
            'fromBlock' => '0x0',
            'toBlock' => 'latest',
            'toAddress' => $address,
            'category' => ['external', 'erc20'],
            'maxCount' => '0x32',
            'order' => 'desc',
        ]],
    ],
]);

$outgoingTransfers = curl_json($alchemyUrl, [
    'method' => 'POST',
    'body' => [
        'jsonrpc' => '2.0',
        'id' => 5,
        'method' => 'alchemy_getAssetTransfers',
        'params' => [[
            'fromBlock' => '0x0',
            'toBlock' => 'latest',
            'fromAddress' => $address,
            'category' => ['external', 'erc20'],
            'maxCount' => '0x32',
            'order' => 'desc',
        ]],
    ],
]);

if (isset($tokenBalances['_error']) || isset($ethBalance['_error'])) {
    json_response(['status' => 'error', 'message' => 'Alchemy wallet fetch failed'], 502);
}

$balances = [];
$contractAddresses = [];

$ethAmount = hex_amount_to_float($ethBalance['result'] ?? '0x0', 18);

if ($ethAmount > 0) {
    $balances[] = [
        'name' => 'Ethereum',
        'symbol' => 'ETH',
        'contract_address' => 'ethereum',
        'balance' => $ethAmount,
        'value_usd' => 0,
    ];
}

foreach (($tokenBalances['result']['tokenBalances'] ?? []) as $token) {
    $rawBalance = $token['tokenBalance'] ?? '0x0';
    if ($rawBalance === '0x0') {
        continue;
    }

    $contract = strtolower($token['contractAddress'] ?? '');
    if (!preg_match('/^0x[a-f0-9]{40}$/', $contract)) {
        continue;
    }

    $meta = curl_json($alchemyUrl, [
        'method' => 'POST',
        'body' => [
            'jsonrpc' => '2.0',
            'id' => 4,
            'method' => 'alchemy_getTokenMetadata',
            'params' => [$contract],
        ],
    ]);

    $decimals = (int) ($meta['result']['decimals'] ?? 18);
    $symbol = $meta['result']['symbol'] ?? strtoupper(substr($contract, 2, 4));
    $name = $meta['result']['name'] ?? $symbol;
    $balance = hex_amount_to_float($rawBalance, $decimals);

    if ($balance <= 0) {
        continue;
    }

    $contractAddresses[] = $contract;
    $balances[] = [
        'name' => $name,
        'symbol' => $symbol,
        'contract_address' => $contract,
        'balance' => $balance,
        'value_usd' => 0,
    ];
}

$prices = [];
if (!empty($contractAddresses)) {
    $priceUrl = 'https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=' .
        urlencode(implode(',', $contractAddresses)) . '&vs_currencies=usd';
    $prices = curl_json($priceUrl);
}
$ethPrice = curl_json('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');

$currentValue = 0.0;
foreach ($balances as &$balance) {
    if ($balance['contract_address'] === 'ethereum') {
        $price = (float) ($ethPrice['ethereum']['usd'] ?? 0);
    } else {
        $price = (float) ($prices[strtolower($balance['contract_address'])]['usd'] ?? 0);
    }
    $balance['value_usd'] = round($balance['balance'] * $price, 2);
    $currentValue += $balance['value_usd'];
}
unset($balance);

$tradeCount = 0;
$invested = 0.0;
if (table_exists($conn, 'trades')) {
    $investedStmt = $conn->prepare(
        "SELECT COUNT(*) AS trade_count,
                COALESCE(SUM(CASE WHEN trade_type = 'buy' THEN buy_price ELSE 0 END), 0) AS invested
         FROM trades WHERE user_id = ?"
    );
    $investedStmt->bind_param('i', $userId);
    $investedStmt->execute();
    $tradeSummary = $investedStmt->get_result()->fetch_assoc();
    $tradeCount = (int) ($tradeSummary['trade_count'] ?? 0);
    $invested = (float) ($tradeSummary['invested'] ?? 0);
}
$pnl = $currentValue - $invested;
$pnlPercent = $invested > 0 ? ($pnl / $invested) * 100 : 0;

$history = [];
if (table_exists($conn, 'portfolio_cache')) {
    $cache = $conn->prepare(
        'INSERT INTO portfolio_cache (user_id, value, invested, profit_loss, last_updated)
         VALUES (?, ?, ?, ?, NOW())'
    );
    $cache->bind_param('iddd', $userId, $currentValue, $invested, $pnl);
    $cache->execute();

    $historyStmt = $conn->prepare(
        'SELECT DATE(last_updated) AS date, MAX(value) AS value_usd, MAX(profit_loss) AS pnl_usd
         FROM portfolio_cache WHERE user_id = ?
         GROUP BY DATE(last_updated)
         ORDER BY DATE(last_updated) ASC
         LIMIT 30'
    );
    $historyStmt->bind_param('i', $userId);
    $historyStmt->execute();
    $history = $historyStmt->get_result()->fetch_all(MYSQLI_ASSOC);
}

if (empty($history)) {
    $history[] = [
        'date' => date('Y-m-d'),
        'value_usd' => $currentValue,
        'pnl_usd' => $pnl,
    ];
}

$transactions = array_merge(
    $incomingTransfers['result']['transfers'] ?? [],
    $outgoingTransfers['result']['transfers'] ?? []
);
usort($transactions, function ($a, $b) {
    return strcmp($b['blockNum'] ?? '', $a['blockNum'] ?? '');
});
$transactions = array_slice($transactions, 0, 50);

$walletMessage = '';
if (empty($balances) && empty($transactions)) {
    $walletMessage = "This wallet is connected, but no Ethereum token balance or recent wallet activity was found.";
} elseif (empty($balances)) {
    $walletMessage = "Wallet activity was found, but there are no non-zero Ethereum token balances to value.";
}

$tradeMessage = $tradeCount === 0
    ? "You have not saved any trading journal entries yet."
    : "Your saved trades are included in the profit/loss estimate.";

json_response([
    'status' => 'success',
    'address' => $address,
    'balances' => $balances,
    'transactions' => $transactions,
    'portfolio' => [
        'current_value_inr' => round($currentValue, 2),
        'current_value_usd' => round($currentValue, 2),
        'invested_inr' => round($invested, 2),
        'invested_usd' => round($invested, 2),
        'profit_loss' => round($pnl, 2),
        'profit_loss_percent' => round($pnlPercent, 2),
        'trade_count' => $tradeCount,
        'currency' => 'USD',
    ],
    'history' => $history,
    'empty_state' => [
        'has_balances' => !empty($balances),
        'has_transactions' => !empty($transactions),
        'has_trades' => $tradeCount > 0,
        'wallet_message' => $walletMessage,
        'trade_message' => $tradeMessage,
    ],
]);
?>
