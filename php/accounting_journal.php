<?php
require_once __DIR__ . '/api_helpers.php';

function ensure_accounting_tables(mysqli $conn): void {
    $conn->query(
        "CREATE TABLE IF NOT EXISTS accounting_journals (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id INT NOT NULL,
            voucher_type VARCHAR(40) NOT NULL DEFAULT 'journal',
            currency_code VARCHAR(8) NOT NULL DEFAULT 'USD',
            counterparty VARCHAR(120) NULL,
            reference_no VARCHAR(80) NULL,
            entry_date DATE NOT NULL,
            narration TEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_accounting_user_date (user_id, entry_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $conn->query(
        "CREATE TABLE IF NOT EXISTS accounting_journal_lines (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            journal_id INT UNSIGNED NOT NULL,
            account_name VARCHAR(120) NOT NULL,
            debit DECIMAL(14,2) NOT NULL DEFAULT 0,
            credit DECIMAL(14,2) NOT NULL DEFAULT 0,
            PRIMARY KEY (id),
            KEY idx_accounting_lines_journal (journal_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    if (!column_exists($conn, 'accounting_journals', 'voucher_type')) {
        $conn->query("ALTER TABLE accounting_journals ADD COLUMN voucher_type VARCHAR(40) NOT NULL DEFAULT 'journal' AFTER user_id");
    }
    if (!column_exists($conn, 'accounting_journals', 'currency_code')) {
        $conn->query("ALTER TABLE accounting_journals ADD COLUMN currency_code VARCHAR(8) NOT NULL DEFAULT 'USD' AFTER voucher_type");
    }
    if (!column_exists($conn, 'accounting_journals', 'counterparty')) {
        $conn->query("ALTER TABLE accounting_journals ADD COLUMN counterparty VARCHAR(120) NULL AFTER voucher_type");
    }
    if (!column_exists($conn, 'accounting_journals', 'reference_no')) {
        $conn->query("ALTER TABLE accounting_journals ADD COLUMN reference_no VARCHAR(80) NULL AFTER counterparty");
    }
}

$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'GET') {
    $email = clean_email($_GET['email'] ?? '');
    $userId = require_user_id($conn, $email);
    ensure_accounting_tables($conn);

    $stmt = $conn->prepare(
        'SELECT j.id, j.entry_date, j.voucher_type, j.currency_code, j.counterparty, j.reference_no, j.narration, j.created_at,
                COALESCE(SUM(l.debit), 0) AS total_debit,
                COALESCE(SUM(l.credit), 0) AS total_credit
         FROM accounting_journals j
         LEFT JOIN accounting_journal_lines l ON l.journal_id = j.id
         WHERE j.user_id = ?
         GROUP BY j.id
         ORDER BY j.entry_date DESC, j.id DESC
         LIMIT 30'
    );
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $entries = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

    if (!empty($entries)) {
        $ids = [];
        foreach ($entries as $entry) {
            $ids[] = (int) $entry['id'];
        }
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $types = str_repeat('i', count($ids));
        $lineStmt = $conn->prepare(
            "SELECT id, journal_id, account_name, debit, credit
             FROM accounting_journal_lines
             WHERE journal_id IN ($placeholders)
             ORDER BY id ASC"
        );
        bind_dynamic($lineStmt, $types, $ids);
        $lineStmt->execute();
        $lines = $lineStmt->get_result()->fetch_all(MYSQLI_ASSOC);

        $linesByJournal = [];
        foreach ($lines as $line) {
            $journalId = (int) $line['journal_id'];
            if (!isset($linesByJournal[$journalId])) {
                $linesByJournal[$journalId] = [];
            }
            $linesByJournal[$journalId][] = $line;
        }

        foreach ($entries as &$entry) {
            $entry['voucher_label'] = ucwords(str_replace('_', ' ', $entry['voucher_type'] ?? 'journal'));
            $entry['lines'] = $linesByJournal[(int) $entry['id']] ?? [];
        }
        unset($entry);
    }

    json_response(['status' => 'success', 'entries' => $entries]);
}

$data = input_json();
$email = clean_email($data['email'] ?? '');
$userId = require_user_id($conn, $email);
$action = strtolower(trim($data['action'] ?? 'create'));
$journalId = (int) ($data['journal_id'] ?? $data['id'] ?? 0);
$voucherType = preg_replace('/[^a-z_ -]/i', '', strtolower(trim($data['voucher_type'] ?? 'journal'))) ?: 'journal';
$currencyCode = strtoupper(preg_replace('/[^A-Z]/i', '', trim($data['currency_code'] ?? 'USD'))) ?: 'USD';
$allowedCurrencies = ['USD', 'INR', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'SGD', 'AED'];
if (!in_array($currencyCode, $allowedCurrencies, true)) {
    $currencyCode = 'USD';
}
$counterparty = trim($data['counterparty'] ?? '');
$referenceNo = trim($data['reference_no'] ?? '');
$date = trim($data['entry_date'] ?? date('Y-m-d'));
$narration = trim($data['narration'] ?? '');
$lines = is_array($data['lines'] ?? null) ? $data['lines'] : [];

ensure_accounting_tables($conn);

if ($action === 'delete') {
    if ($journalId <= 0) {
        json_response(['status' => 'error', 'message' => 'Voucher id is required'], 400);
    }
    $owner = $conn->prepare('SELECT id FROM accounting_journals WHERE id = ? AND user_id = ? LIMIT 1');
    $owner->bind_param('ii', $journalId, $userId);
    $owner->execute();
    if (!$owner->get_result()->fetch_assoc()) {
        json_response(['status' => 'error', 'message' => 'Voucher was not found'], 404);
    }
    $conn->begin_transaction();
    try {
        $lineDelete = $conn->prepare('DELETE FROM accounting_journal_lines WHERE journal_id = ?');
        $lineDelete->bind_param('i', $journalId);
        $lineDelete->execute();
        $journalDelete = $conn->prepare('DELETE FROM accounting_journals WHERE id = ? AND user_id = ?');
        $journalDelete->bind_param('ii', $journalId, $userId);
        $journalDelete->execute();
        $conn->commit();
        json_response(['status' => 'success', 'message' => 'Voucher deleted']);
    } catch (Throwable $e) {
        $conn->rollback();
        error_log('accounting_journal delete: ' . $e->getMessage());
        json_response(['status' => 'error', 'message' => 'Could not delete voucher'], 500);
    }
}

if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || $narration === '' || count($lines) < 2) {
    json_response(['status' => 'error', 'message' => 'Date, narration, and at least two ledger lines are required'], 400);
}

$cleanLines = [];
$totalDebit = 0.0;
$totalCredit = 0.0;
foreach ($lines as $line) {
    $account = trim($line['account_name'] ?? '');
    $debit = (float) ($line['debit'] ?? 0);
    $credit = (float) ($line['credit'] ?? 0);
    if ($account === '' || ($debit <= 0 && $credit <= 0)) {
        continue;
    }
    $cleanLines[] = [$account, $debit, $credit];
    $totalDebit += $debit;
    $totalCredit += $credit;
}

if (count($cleanLines) < 2 || round($totalDebit, 2) !== round($totalCredit, 2)) {
    json_response(['status' => 'error', 'message' => 'Journal must balance: total debit must equal total credit'], 400);
}

$conn->begin_transaction();
try {
    if ($action === 'update') {
        if ($journalId <= 0) {
            json_response(['status' => 'error', 'message' => 'Voucher id is required'], 400);
        }
        $owner = $conn->prepare('SELECT id FROM accounting_journals WHERE id = ? AND user_id = ? LIMIT 1');
        $owner->bind_param('ii', $journalId, $userId);
        $owner->execute();
        if (!$owner->get_result()->fetch_assoc()) {
            json_response(['status' => 'error', 'message' => 'Voucher was not found'], 404);
        }
        $stmt = $conn->prepare(
            'UPDATE accounting_journals
             SET voucher_type = ?, currency_code = ?, counterparty = ?, reference_no = ?, entry_date = ?, narration = ?
             WHERE id = ? AND user_id = ?'
        );
        $stmt->bind_param('ssssssii', $voucherType, $currencyCode, $counterparty, $referenceNo, $date, $narration, $journalId, $userId);
        $stmt->execute();
        if ($stmt->affected_rows < 0) {
            throw new RuntimeException('Voucher update failed');
        }
        $deleteLines = $conn->prepare('DELETE FROM accounting_journal_lines WHERE journal_id = ?');
        $deleteLines->bind_param('i', $journalId);
        $deleteLines->execute();
    } else {
        $stmt = $conn->prepare('INSERT INTO accounting_journals (user_id, voucher_type, currency_code, counterparty, reference_no, entry_date, narration) VALUES (?, ?, ?, ?, ?, ?, ?)');
        $stmt->bind_param('issssss', $userId, $voucherType, $currencyCode, $counterparty, $referenceNo, $date, $narration);
        $stmt->execute();
        $journalId = $stmt->insert_id;
    }

    $lineStmt = $conn->prepare(
        'INSERT INTO accounting_journal_lines (journal_id, account_name, debit, credit) VALUES (?, ?, ?, ?)'
    );
    foreach ($cleanLines as $line) {
        [$account, $debit, $credit] = $line;
        $lineStmt->bind_param('isdd', $journalId, $account, $debit, $credit);
        $lineStmt->execute();
    }

    $conn->commit();
    json_response([
        'status' => 'success',
        'id' => $journalId,
        'message' => $action === 'update' ? 'Accounting voucher updated' : 'Accounting voucher saved',
    ]);
} catch (Throwable $e) {
    $conn->rollback();
    error_log('accounting_journal.php: ' . $e->getMessage());
    json_response(['status' => 'error', 'message' => 'Could not save accounting journal'], 500);
}
?>
