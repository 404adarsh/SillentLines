import shutil
import subprocess
import sys
from pathlib import Path
from typing import Optional


ROOT = Path(__file__).resolve().parents[1]
CLI = ROOT / "php" / "setup_database_cli.php"


def find_php_executable() -> Optional[str]:
    php_path = shutil.which("php")
    if php_path:
        return php_path

    if sys.platform.startswith("win"):
        candidates = [
            r"C:\xampp\php\php.exe",
            r"C:\Program Files\xampp\php\php.exe",
            r"C:\Program Files (x86)\xampp\php\php.exe",
        ]
    else:
        candidates = [
            "/opt/lampp/bin/php",
            "/Applications/XAMPP/xamppfiles/bin/php",
            "/usr/local/bin/php",
            "/usr/bin/php",
        ]

    for candidate in candidates:
        if Path(candidate).exists():
            return candidate

    return None


def main() -> int:
    print("Silent Lines local database setup")
    print("This only uses your local PHP/MySQL configuration.")

    php_executable = find_php_executable()
    if not php_executable:
        print(
            "PHP was not found on PATH. If you use XAMPP on Windows, make sure XAMPP is installed and Apache/MySQL are running.",
            file=sys.stderr,
        )
        print(
            "On Linux, look for LAMPP/XAMPP or install PHP and ensure it is available on PATH.",
            file=sys.stderr,
        )
        print("You can also run php/setup_database_cli.php manually with an existing PHP installation.", file=sys.stderr)
        return 1

    print(f"Using PHP executable: {php_executable}")
    return subprocess.call([php_executable, str(CLI)], cwd=str(ROOT))


if __name__ == "__main__":
    raise SystemExit(main())
