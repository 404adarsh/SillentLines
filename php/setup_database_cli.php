<?php
require_once __DIR__ . '/setup_schema.php';

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "This setup helper can only run from the command line.\n");
    exit(1);
}

$status = setup_database_exists();
if ($status['ok'] && $status['exists']) {
    echo "Database '{$status['database']}' already exists.\n";
    exit(0);
}

if (!$status['ok']) {
    echo "Local MySQL check failed: {$status['message']}\n";
}

echo "Database '{$status['database']}' is not ready. Create database and tables now? [y/N] ";
$answer = strtolower(trim((string) fgets(STDIN)));
if (!in_array($answer, ['y', 'yes'], true)) {
    echo "Setup cancelled. No database changes were made.\n";
    exit(0);
}

try {
    $result = setup_create_database_and_tables();
    echo "Created/verified {$result['tables']} tables in '{$result['database']}'.\n";
    exit(0);
} catch (Throwable $e) {
    fwrite(STDERR, "Setup failed: " . $e->getMessage() . "\n");
    exit(1);
}
?>
