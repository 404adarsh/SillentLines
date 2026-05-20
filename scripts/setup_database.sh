#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Silent Lines local database setup"
echo "This only uses your local PHP/MySQL configuration."

PHP_CMD=""
if command -v php >/dev/null 2>&1; then
  PHP_CMD="$(command -v php)"
elif [ -x "/opt/lampp/bin/php" ]; then
  PHP_CMD="/opt/lampp/bin/php"
elif [ -x "/Applications/XAMPP/xamppfiles/bin/php" ]; then
  PHP_CMD="/Applications/XAMPP/xamppfiles/bin/php"
fi

if [ -z "$PHP_CMD" ]; then
  echo "PHP was not found on PATH. If you use XAMPP on Linux, install or start LAMPP/XAMPP and ensure the PHP binary is available." >&2
  echo "On Windows, open XAMPP Control Panel and start Apache and MySQL, or run setup_database_cli.php with a PHP executable." >&2
  exit 1
fi

echo "Using PHP executable: $PHP_CMD"

"$PHP_CMD" "$ROOT/php/setup_database_cli.php"
