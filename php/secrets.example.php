<?php
// Copy this file to secrets.php on the server. Do not commit real credentials.
define('DIARY_DB_HOST', 'localhost');
define('DIARY_DB_USER', 'root');
define('DIARY_DB_PASS', '');
define('DIARY_DB_NAME', 'silentlinesdiary');

define('AUTH0_DOMAIN', 'your-tenant.region.auth0.com');
define('AUTH0_CLIENT_ID', 'your_public_client_id');

define('ALCHEMY_API_KEY', 'your-alchemy-api-key');
define('SARVAM_API_KEY', 'your-sarvam-api-key');
define('SARVAM_MODEL', 'sarvam-30b');
define('OPENAI_API_KEY', 'your-openai-api-key');
define('OPENAI_MODEL', 'gpt-4o-mini');

// Diary lock password reset email. You can also provide the same names as environment variables.
define('DIARY_SMTP_HOST', '');
define('DIARY_SMTP_PORT', '');
define('DIARY_SMTP_SECURE', '');
define('DIARY_SMTP_USER', '');
define('DIARY_SMTP_PASS', '');
define('DIARY_MAIL_FROM', '');
define('DIARY_MAIL_FROM_NAME', 'SilentLines');
?>
