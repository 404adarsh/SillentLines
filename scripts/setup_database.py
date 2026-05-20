import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CLI = ROOT / "php" / "setup_database_cli.php"


def main() -> int:
    print("Silent Lines local database setup")
    print("This only uses your local PHP/MySQL configuration.")
    try:
        return subprocess.call(["php", str(CLI)], cwd=str(ROOT))
    except FileNotFoundError:
        print("PHP was not found on PATH. Install PHP or run php/setup_database_cli.php manually.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
