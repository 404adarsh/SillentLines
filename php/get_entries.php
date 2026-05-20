<?php
require_once __DIR__ . '/api_helpers.php';

$data = input_json();
$email = clean_email($data['email'] ?? $data['user_email'] ?? $data['owner_email'] ?? '');
$userId = require_user_id($conn, $email);
$profile = user_profile($conn, $email);
$ownerId = (int) ($profile['id'] ?? $userId);
$archivedOnly = filter_var($data['archived'] ?? false, FILTER_VALIDATE_BOOLEAN);

$table = diary_table($conn);
ensure_diary_metadata_columns($conn, $table);
ensure_diary_share_tables($conn);
$textColumn = column_exists($conn, $table, 'entry_text') ? 'entry_text' : 'entry';
$emotionExpr = column_exists($conn, $table, 'emotion') ? 'd.emotion' : (column_exists($conn, $table, 'mood') ? 'd.mood' : "''");
$createdExpr = column_exists($conn, $table, 'created_at') ? 'd.created_at' : 'NOW()';
$ivExpr = column_exists($conn, $table, 'entry_iv') ? 'd.entry_iv' : "''";
$titleExpr = column_exists($conn, $table, 'diary_title') ? 'd.diary_title' : "''";
$diaryDateExpr = column_exists($conn, $table, 'diary_date') ? 'd.diary_date' : 'DATE(' . $createdExpr . ')';

$ownerEmailExpr = "''";
if (column_exists($conn, $table, 'user_email')) {
    $ownerEmailExpr = 'd.user_email';
} elseif (column_exists($conn, $table, 'owner_email')) {
    $ownerEmailExpr = 'd.owner_email';
} elseif (column_exists($conn, $table, 'email')) {
    $ownerEmailExpr = 'd.email';
}

$ownerNameExpr = "''";
if (column_exists($conn, $table, 'user_full_name')) {
    $ownerNameExpr = 'd.user_full_name';
}

$hasTrades = table_exists($conn, 'trades');
$hasCommits = table_exists($conn, 'diary_entry_commits');
$tradeJoinSql = $hasTrades ? 'LEFT JOIN trades t ON t.diary_entry_id = d.id AND t.user_id = ?' : '';
$tradeSelectSql = $hasTrades
    ? 't.asset, t.trade_type, t.buy_price AS entry_price, t.sell_price AS exit_price'
    : "'' AS asset, '' AS trade_type, NULL AS entry_price, NULL AS exit_price";
$commitCountExpr = $hasCommits ? '(SELECT COUNT(*) FROM diary_entry_commits dc WHERE dc.entry_id = d.id)' : '0';

$ownerFilters = [];
$types = '';
$values = [];

if (column_exists($conn, $table, 'user_id')) {
    $ownerFilters[] = 'd.user_id = ?';
    $types .= 'i';
    $values[] = $userId;
}
if (column_exists($conn, $table, 'owner_id')) {
    $ownerFilters[] = 'd.owner_id = ?';
    $types .= 'i';
    $values[] = $ownerId;
}
if (column_exists($conn, $table, 'user_email')) {
    $ownerFilters[] = 'LOWER(d.user_email) = LOWER(?)';
    $types .= 's';
    $values[] = $email;
}
if (column_exists($conn, $table, 'owner_email')) {
    $ownerFilters[] = 'LOWER(d.owner_email) = LOWER(?)';
    $types .= 's';
    $values[] = $email;
}
if (column_exists($conn, $table, 'email')) {
    $ownerFilters[] = 'LOWER(d.email) = LOWER(?)';
    $types .= 's';
    $values[] = $email;
}

if (!$ownerFilters) {
    json_response(['status' => 'error', 'message' => 'Diary table has no supported owner column'], 500);
}

$where = '(' . implode(' OR ', $ownerFilters) . ')';

$joinCollaborators = table_exists($conn, 'diary_collaborators') && table_exists($conn, 'diaryusers');
if ($joinCollaborators) {
    $where = '(' . $where . ' OR (c.user_id = ? AND c.status = ?))';
    $types .= 'is';
    $values[] = $userId;
    $values[] = 'accepted';
}

$collabJoinSql = $joinCollaborators
    ? ' LEFT JOIN diary_collaborators c ON c.entry_id = d.id '
    : '';
$archiveJoinSql = " LEFT JOIN diary_archives a ON a.entry_id = d.id AND a.user_id = $userId ";
$where .= $archivedOnly ? ' AND a.id IS NOT NULL' : ' AND a.id IS NULL';

$sql = "SELECT DISTINCT d.id, d.$textColumn AS entry_text, $ivExpr AS entry_iv,
               $emotionExpr AS emotion, $createdExpr AS created_at,
               $titleExpr AS diary_title, $diaryDateExpr AS diary_date,
               $ownerEmailExpr AS owner_email, $ownerNameExpr AS owner_full_name,
               $commitCountExpr AS commit_count,
               CASE WHEN a.id IS NULL THEN 0 ELSE 1 END AS is_archived,
               $tradeSelectSql
        FROM $table d
        $collabJoinSql
        $tradeJoinSql
        $archiveJoinSql
        WHERE $where
        ORDER BY $createdExpr DESC, d.id DESC";

if ($hasTrades) {
    $types = 'i' . $types;
    array_unshift($values, $userId);
}

$stmt = $conn->prepare($sql);
if (!$stmt) {
    json_response(['status' => 'error', 'message' => 'Query prepare failed: ' . $conn->error], 500);
}

bind_dynamic($stmt, $types, $values);

if (!$stmt->execute()) {
    json_response(['status' => 'error', 'message' => 'Query execute failed: ' . $stmt->error], 500);
}

$entries = $stmt->get_result()->fetch_all(MYSQLI_ASSOC) ?: [];
$entryIds = [];

foreach ($entries as &$entry) {
    $entryIds[] = (int) $entry['id'];

    if (!empty($entry['entry_iv']) && function_exists('decryptDiaryEntry')) {
        $decrypted = decryptDiaryEntry((string) $entry['entry_text'], (string) $entry['entry_iv']);
        $entry['entry_text'] = $decrypted === false ? '' : $decrypted;
    }

    $ownerEmail = strtolower((string) ($entry['owner_email'] ?? ''));
    $entry['owner_is_current_user'] = $ownerEmail === '' || $ownerEmail === strtolower($email);
    $entry['owner_label'] = $entry['owner_is_current_user']
        ? 'You'
        : (($entry['owner_full_name'] ?? '') ?: $entry['owner_email'] ?: 'Shared note');
    $entry['collaborators'] = [];
    unset($entry['entry_iv'], $entry['owner_full_name']);
}
unset($entry);

if ($joinCollaborators && $entryIds) {
    $ids = array_values(array_unique(array_map('intval', $entryIds)));
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $collabTypes = str_repeat('i', count($ids));
    $collabSql = "SELECT c.entry_id, u.id, u.username, u.full_name, u.email
                  FROM diary_collaborators c
                  JOIN diaryusers u ON u.id = c.user_id
                  WHERE c.status = 'accepted' AND c.entry_id IN ($placeholders)";
    $collabStmt = $conn->prepare($collabSql);
    if ($collabStmt) {
        bind_dynamic($collabStmt, $collabTypes, $ids);
        if ($collabStmt->execute()) {
            $collabRows = $collabStmt->get_result()->fetch_all(MYSQLI_ASSOC) ?: [];
            $entriesById = [];
            foreach ($entries as $index => $entry) {
                $entriesById[(int) $entry['id']] = $index;
            }
            foreach ($collabRows as $collab) {
                $entryId = (int) $collab['entry_id'];
                if (!isset($entriesById[$entryId])) {
                    continue;
                }
                if (strtolower((string) $collab['email']) === strtolower($email)) {
                    continue;
                }
                $entries[$entriesById[$entryId]]['collaborators'][] = [
                    'id' => (int) $collab['id'],
                    'username' => $collab['username'] ?? '',
                    'full_name' => $collab['full_name'] ?? '',
                    'email' => $collab['email'] ?? '',
                ];
            }
        }
    }
}

json_response(['status' => 'success', 'count' => count($entries), 'entries' => $entries]);
?>
