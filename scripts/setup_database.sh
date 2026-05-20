#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Silent Lines local database setup"
echo "This only uses your local PHP/MySQL configuration."

if ! command -v php >/dev/null 2>&1; then
  echo "PHP was not found on PATH. Install PHP or run php/setup_database_cli.php manually." >&2
  exit 1
fi

php "$ROOT/php/setup_database_cli.php"
