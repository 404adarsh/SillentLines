<?php
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

function setup_config_value(string $name, string $fallback): string {
    $secretsPath = __DIR__ . '/secrets.php';
    if (file_exists($secretsPath)) {
        require_once $secretsPath;
    }

    $value = getenv($name);
    if (is_string($value) && $value !== '') {
        return $value;
    }
    if (defined($name)) {
        $constantValue = constant($name);
        return is_string($constantValue) ? $constantValue : $fallback;
    }
    return $fallback;
}

function setup_db_config(): array {
    return [
        'host' => setup_config_value('DIARY_DB_HOST', 'localhost'),
        'user' => setup_config_value('DIARY_DB_USER', 'root'),
        'pass' => setup_config_value('DIARY_DB_PASS', ''),
        'name' => setup_config_value('DIARY_DB_NAME', 'silentlinesdiary'),
    ];
}

function setup_is_local_request(): bool {
    $remote = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
    if (!in_array($remote, ['127.0.0.1', '::1', 'localhost'], true)) {
        return false;
    }

    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') {
        return true;
    }

    $host = parse_url($origin, PHP_URL_HOST);
    return in_array($host, ['localhost', '127.0.0.1'], true);
}

function setup_database_exists(): array {
    $config = setup_db_config();
    try {
        $conn = new mysqli($config['host'], $config['user'], $config['pass']);
        $conn->set_charset('utf8mb4');
        $stmt = $conn->prepare('SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ? LIMIT 1');
        $stmt->bind_param('s', $config['name']);
        $stmt->execute();
        $exists = (bool) $stmt->get_result()->fetch_assoc();
        return ['ok' => true, 'exists' => $exists, 'database' => $config['name']];
    } catch (Throwable $e) {
        return ['ok' => false, 'exists' => false, 'database' => $config['name'], 'message' => $e->getMessage()];
    }
}

function setup_create_database_and_tables(): array {
    $config = setup_db_config();
    $conn = new mysqli($config['host'], $config['user'], $config['pass']);
    $conn->set_charset('utf8mb4');

    $database = setup_safe_identifier($config['name']);
    $conn->query("CREATE DATABASE IF NOT EXISTS `$database` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $conn->select_db($config['name']);

    foreach (setup_table_sql() as $sql) {
        $conn->query($sql);
    }

    return ['ok' => true, 'database' => $config['name'], 'tables' => count(setup_table_sql())];
}

function setup_safe_identifier(string $name): string {
    if (!preg_match('/^[a-zA-Z0-9_]+$/', $name)) {
        throw new RuntimeException('Database name may only contain letters, numbers, and underscores.');
    }
    return $name;
}

function setup_table_sql(): array {
    return [
        "CREATE TABLE IF NOT EXISTS diaryusers (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            auth0_token VARCHAR(128) NULL,
            full_name VARCHAR(180) NULL,
            username VARCHAR(120) NOT NULL,
            email VARCHAR(190) NOT NULL,
            login_time_ist DATETIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            username_changed_at DATETIME NULL,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_diaryusers_email (email),
            UNIQUE KEY uniq_diaryusers_username (username)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        "CREATE TABLE IF NOT EXISTS users (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            auth0_token VARCHAR(128) NULL,
            full_name VARCHAR(180) NULL,
            username VARCHAR(120) NOT NULL,
            email VARCHAR(190) NOT NULL,
            login_time_ist DATETIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_users_email (email),
            UNIQUE KEY uniq_users_username (username)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        "CREATE TABLE IF NOT EXISTS diary_entries (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id INT UNSIGNED NULL,
            owner_id INT UNSIGNED NULL,
            email VARCHAR(190) NULL,
            user_email VARCHAR(190) NULL,
            owner_email VARCHAR(190) NULL,
            user_username VARCHAR(120) NULL,
            user_full_name VARCHAR(180) NULL,
            entry_text MEDIUMTEXT NOT NULL,
            entry_iv VARCHAR(80) NULL,
            emotion VARCHAR(60) NULL,
            diary_title VARCHAR(180) NULL,
            diary_date DATE NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_diary_entries_user_date (user_id, created_at),
            KEY idx_diary_entries_email_date (email, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        "CREATE TABLE IF NOT EXISTS diary_archives (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            entry_id INT NOT NULL,
            user_id INT NOT NULL,
            archived_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_diary_archive_user_entry (user_id, entry_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        "CREATE TABLE IF NOT EXISTS diary_public_shares (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            entry_id INT NOT NULL,
            token VARCHAR(80) NOT NULL,
            created_by_user_id INT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            revoked_at DATETIME NULL,
            theme_json MEDIUMTEXT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_diary_public_token (token),
            UNIQUE KEY uniq_diary_public_entry_creator (entry_id, created_by_user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        "CREATE TABLE IF NOT EXISTS diary_collaborators (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            entry_id INT NOT NULL,
            user_id INT NOT NULL,
            owner_id INT NOT NULL,
            status VARCHAR(24) NOT NULL DEFAULT 'pending',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            accepted_at DATETIME NULL,
            notified_at DATETIME NULL,
            email_sent_at DATETIME NULL,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_diary_collab_entry_user (entry_id, user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        "CREATE TABLE IF NOT EXISTS diary_notifications (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            recipient_email VARCHAR(190) NOT NULL,
            sender_id INT NOT NULL DEFAULT 0,
            sender_username VARCHAR(120) NULL,
            entry_id INT NULL,
            message VARCHAR(255) NOT NULL,
            is_read TINYINT(1) NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_diary_notifications_recipient (recipient_email, is_read, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        "CREATE TABLE IF NOT EXISTS diary_share_presence (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            token VARCHAR(80) NOT NULL,
            entry_id INT NOT NULL,
            user_id INT NOT NULL DEFAULT 0,
            user_email VARCHAR(190) NOT NULL,
            username VARCHAR(120) NULL,
            full_name VARCHAR(180) NULL,
            role VARCHAR(32) NOT NULL DEFAULT 'collaborator',
            page_index INT NOT NULL DEFAULT 0,
            cursor_hint VARCHAR(120) NULL,
            last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_share_presence_token_user (token, user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        "CREATE TABLE IF NOT EXISTS diary_user_blocks (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            blocker_user_id INT NOT NULL,
            blocked_user_id INT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_diary_user_block (blocker_user_id, blocked_user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        "CREATE TABLE IF NOT EXISTS diary_entry_commits (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            entry_id INT NOT NULL,
            author_user_id INT NOT NULL,
            author_email VARCHAR(190) NOT NULL,
            author_name VARCHAR(190) NULL,
            author_username VARCHAR(120) NULL,
            commit_message VARCHAR(240) NULL,
            before_title VARCHAR(180) NULL,
            after_title VARCHAR(180) NULL,
            before_text MEDIUMTEXT NULL,
            after_text MEDIUMTEXT NULL,
            before_emotion VARCHAR(60) NULL,
            after_emotion VARCHAR(60) NULL,
            before_diary_date DATE NULL,
            after_diary_date DATE NULL,
            changed_fields VARCHAR(255) NOT NULL DEFAULT '',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_diary_commits_entry_date (entry_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        "CREATE TABLE IF NOT EXISTS diary_commit_email_cooldowns (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            entry_id INT NOT NULL,
            recipient_user_id INT NOT NULL DEFAULT 0,
            recipient_email VARCHAR(190) NOT NULL,
            last_email_sent_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_diary_commit_email_recipient (entry_id, recipient_email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        "CREATE TABLE IF NOT EXISTS user_wallets (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id INT NOT NULL,
            wallet_address VARCHAR(42) NOT NULL,
            wallet_type VARCHAR(32) NOT NULL DEFAULT 'evm',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_user_wallet (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        "CREATE TABLE IF NOT EXISTS trades (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id INT NOT NULL,
            diary_entry_id INT NULL,
            asset VARCHAR(32) NOT NULL,
            trade_type ENUM('buy', 'sell') NOT NULL DEFAULT 'buy',
            buy_price DECIMAL(24, 8) NULL,
            sell_price DECIMAL(24, 8) NULL,
            trade_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_trade_diary_entry (diary_entry_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        "CREATE TABLE IF NOT EXISTS user_preferences (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id INT NOT NULL,
            use_personal TINYINT(1) NOT NULL DEFAULT 0,
            use_trading TINYINT(1) NOT NULL DEFAULT 0,
            use_accounting TINYINT(1) NOT NULL DEFAULT 0,
            use_commerce TINYINT(1) NOT NULL DEFAULT 0,
            use_programming TINYINT(1) NOT NULL DEFAULT 0,
            experience_level VARCHAR(32) NOT NULL DEFAULT 'beginner',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_user_preferences (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        "CREATE TABLE IF NOT EXISTS diary_writing_customizations (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id INT NOT NULL,
            settings_json MEDIUMTEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_writing_customization_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        "CREATE TABLE IF NOT EXISTS diary_lock_settings (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id INT NOT NULL,
            email VARCHAR(190) NOT NULL,
            password_hash VARCHAR(255) NULL,
            is_enabled TINYINT(1) NOT NULL DEFAULT 0,
            lock_mode VARCHAR(32) NOT NULL DEFAULT 'always',
            recovery_hint VARCHAR(255) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_diary_lock_email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        "CREATE TABLE IF NOT EXISTS diary_lock_reset_logs (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id INT NOT NULL,
            email VARCHAR(190) NOT NULL,
            sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_lock_reset_email_time (email, sent_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        "CREATE TABLE IF NOT EXISTS diary_lock_attempts (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id INT NOT NULL,
            email VARCHAR(190) NOT NULL,
            success TINYINT(1) NOT NULL DEFAULT 0,
            attempted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_lock_attempt_email_time (email, attempted_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        "CREATE TABLE IF NOT EXISTS daily_workspace_entries (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id INT NOT NULL,
            entry_date DATE NOT NULL,
            mood VARCHAR(40) NOT NULL DEFAULT '',
            energy TINYINT UNSIGNED NOT NULL DEFAULT 3,
            focus_area VARCHAR(80) NOT NULL DEFAULT '',
            intention TEXT NULL,
            quick_note MEDIUMTEXT NULL,
            ai_reflection MEDIUMTEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_daily_workspace_user_date (user_id, entry_date),
            KEY idx_daily_workspace_user_updated (user_id, updated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        "CREATE TABLE IF NOT EXISTS programming_journals (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id INT NOT NULL,
            title VARCHAR(160) NOT NULL,
            language VARCHAR(40) NOT NULL DEFAULT 'html',
            tags VARCHAR(255) NOT NULL DEFAULT '',
            html_code MEDIUMTEXT NOT NULL,
            css_code MEDIUMTEXT NOT NULL,
            js_code MEDIUMTEXT NOT NULL,
            notes MEDIUMTEXT NOT NULL,
            goal TEXT NULL,
            bug_notes TEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_programming_user_updated (user_id, updated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        "CREATE TABLE IF NOT EXISTS accounting_journal_lines (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            journal_id INT NOT NULL,
            account_name VARCHAR(180) NOT NULL,
            debit DECIMAL(14, 2) NOT NULL DEFAULT 0,
            credit DECIMAL(14, 2) NOT NULL DEFAULT 0,
            PRIMARY KEY (id),
            KEY idx_accounting_lines_journal (journal_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        "CREATE TABLE IF NOT EXISTS diary_people (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id INT NOT NULL,
            name VARCHAR(160) NOT NULL,
            details TEXT NULL,
            linked_user_id INT NULL,
            linked_username VARCHAR(160) NULL,
            linked_email VARCHAR(255) NULL,
            linked_full_name VARCHAR(255) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_diary_people_user (user_id, name),
            KEY idx_diary_people_linked_user (linked_user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        "CREATE TABLE IF NOT EXISTS diary_person_entries (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            person_id INT UNSIGNED NOT NULL,
            user_id INT NOT NULL,
            entry_date DATE NOT NULL,
            knowledge TEXT NULL,
            behavior TEXT NULL,
            notes TEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_person_entries_person_date (person_id, entry_date),
            KEY idx_person_entries_user_date (user_id, entry_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        "CREATE TABLE IF NOT EXISTS diary_person_chats (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            person_id INT UNSIGNED NOT NULL,
            user_id INT NOT NULL,
            role ENUM('user', 'assistant') NOT NULL,
            message MEDIUMTEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_person_chats_person_date (person_id, created_at),
            KEY idx_person_chats_user_date (user_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        "CREATE TABLE IF NOT EXISTS diary_universal_chats (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id INT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_universal_chats_user (user_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        "CREATE TABLE IF NOT EXISTS diary_universal_chat_messages (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            session_id INT NOT NULL,
            user_id INT NOT NULL,
            role VARCHAR(32) NOT NULL,
            message MEDIUMTEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_universal_messages_session (session_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        "CREATE TABLE IF NOT EXISTS diary_ai_controls (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id INT NOT NULL,
            email VARCHAR(190) NOT NULL,
            is_enabled TINYINT(1) NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_ai_controls_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        "CREATE TABLE IF NOT EXISTS diary_ai_access_logs (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id INT NOT NULL,
            email VARCHAR(190) NOT NULL,
            action VARCHAR(80) NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_ai_access_user_time (user_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        "CREATE TABLE IF NOT EXISTS diary_collaboration_history (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            entry_id INT NOT NULL,
            actor_user_id INT NOT NULL,
            action VARCHAR(80) NOT NULL,
            target_user_id INT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_collab_history_entry (entry_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        "CREATE TABLE IF NOT EXISTS username_change_logs (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id INT NOT NULL,
            old_username VARCHAR(120) NULL,
            new_username VARCHAR(120) NOT NULL,
            changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_username_logs_user (user_id, changed_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        "CREATE TABLE IF NOT EXISTS diary_email_preferences (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id INT NOT NULL,
            email VARCHAR(190) NOT NULL,
            commit_emails_enabled TINYINT(1) NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_email_preferences_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        "CREATE TABLE IF NOT EXISTS diary_email_entry_mutes (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id INT NOT NULL,
            entry_id INT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_entry_mute (user_id, entry_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        "CREATE TABLE IF NOT EXISTS diary_email_sender_allowlist (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id INT NOT NULL,
            sender_user_id INT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_sender_allowlist (user_id, sender_user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    ];
}
?>
