<?php
require_once __DIR__ . '/api_helpers.php';

function ensure_diary_ai_tables(mysqli $conn): void {
    $conn->query(
        "CREATE TABLE IF NOT EXISTS diary_ai_controls (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id INT NOT NULL,
            is_blocked TINYINT(1) NOT NULL DEFAULT 0,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_ai_controls_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $conn->query(
        "CREATE TABLE IF NOT EXISTS diary_ai_access_logs (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id INT NOT NULL,
            entry_id INT NULL,
            action VARCHAR(32) NOT NULL,
            provider VARCHAR(80) NULL,
            prompt_excerpt VARCHAR(255) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            ip_address VARCHAR(64) NULL,
            user_agent VARCHAR(255) NULL,
            PRIMARY KEY (id),
            KEY idx_ai_logs_user_time (user_id, created_at),
            KEY idx_ai_logs_entry (entry_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

function diary_ai_customization(mysqli $conn, int $userId): array {
    if (!table_exists($conn, 'diary_writing_customizations')) {
        return ['ai_enabled' => true, 'ai_blocked' => false];
    }
    $stmt = $conn->prepare('SELECT settings_json FROM diary_writing_customizations WHERE user_id = ? LIMIT 1');
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $settings = $row ? json_decode((string) $row['settings_json'], true) : [];
    return [
        'ai_enabled' => array_key_exists('ai_enabled', (array) $settings) ? !empty($settings['ai_enabled']) : true,
        'ai_blocked' => !empty($settings['ai_blocked']),
    ];
}

function diary_ai_control_state(mysqli $conn, int $userId): bool {
    ensure_diary_ai_tables($conn);
    $stmt = $conn->prepare('SELECT is_blocked FROM diary_ai_controls WHERE user_id = ? LIMIT 1');
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    return !empty($row['is_blocked']);
}

function update_diary_ai_control(mysqli $conn, int $userId, bool $blocked): void {
    ensure_diary_ai_tables($conn);
    $stmt = $conn->prepare(
        'INSERT INTO diary_ai_controls (user_id, is_blocked)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE is_blocked = VALUES(is_blocked), updated_at = CURRENT_TIMESTAMP'
    );
    $flag = $blocked ? 1 : 0;
    $stmt->bind_param('ii', $userId, $flag);
    $stmt->execute();
}

function log_diary_ai_access(mysqli $conn, int $userId, ?int $entryId, string $action, string $provider = '', string $prompt = ''): void {
    ensure_diary_ai_tables($conn);
    $excerpt = substr(trim(preg_replace('/\s+/', ' ', $prompt)), 0, 255);
    $ip = substr((string) ($_SERVER['REMOTE_ADDR'] ?? ''), 0, 64);
    $agent = substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255);
    $stmt = $conn->prepare(
        'INSERT INTO diary_ai_access_logs (user_id, entry_id, action, provider, prompt_excerpt, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    $entryValue = $entryId ?? 0;
    $stmt->bind_param('iisssss', $userId, $entryValue, $action, $provider, $excerpt, $ip, $agent);
    $stmt->execute();
}

$data = input_json();
$email = clean_email($data['email'] ?? '');
$userId = require_user_id($conn, $email);
ensure_diary_ai_tables($conn);
$customization = diary_ai_customization($conn, $userId);
$blocked = diary_ai_control_state($conn, $userId) || !empty($customization['ai_blocked']) || empty($customization['ai_enabled']);

$existingText = trim($data['existing_text'] ?? '');
$mood = preg_replace('/[^a-z_ -]/i', '', $data['mood'] ?? 'current feeling') ?: 'current feeling';
$mode = preg_replace('/[^a-z_ -]/i', '', $data['mode'] ?? 'express') ?: 'express';
$instruction = trim($data['instruction'] ?? '');
$action = preg_replace('/[^a-z_]/i', '', $data['action'] ?? 'ask') ?: 'ask';
$entryId = isset($data['entry_id']) ? (int) $data['entry_id'] : null;

if ($action === 'status') {
    $stmt = $conn->prepare("SELECT COUNT(*) AS c FROM diary_ai_access_logs WHERE user_id = ? AND created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')");
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $accessCount = (int) ($stmt->get_result()->fetch_assoc()['c'] ?? 0);

    $recentStmt = $conn->prepare(
        'SELECT action, provider, prompt_excerpt, created_at
         FROM diary_ai_access_logs
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT 8'
    );
    $recentStmt->bind_param('i', $userId);
    $recentStmt->execute();
    $recent = $recentStmt->get_result()->fetch_all(MYSQLI_ASSOC) ?: [];

    json_response([
        'status' => 'success',
        'ai_enabled' => !empty($customization['ai_enabled']) ? 1 : 0,
        'is_blocked' => $blocked ? 1 : 0,
        'access_count' => $accessCount,
        'recent_access' => $recent,
    ]);
}

if ($action === 'block' || $action === 'unblock') {
    $nextBlocked = $action === 'block';
    update_diary_ai_control($conn, $userId, $nextBlocked);
    log_diary_ai_access($conn, $userId, $entryId, $action, 'control', $instruction);
    json_response([
        'status' => 'success',
        'is_blocked' => $nextBlocked ? 1 : 0,
        'message' => $nextBlocked ? 'AI has been blocked for this account.' : 'AI has been unblocked for this account.',
    ]);
}

if ($blocked) {
    log_diary_ai_access($conn, $userId, $entryId, 'blocked', 'control', $instruction);
    json_response(['status' => 'error', 'message' => 'AI is blocked for this account. Unblock it from settings to continue.'], 423);
}

if ($existingText === '' && !in_array($mode, ['idea', 'today_sadness', 'companion', 'tease_flirt'], true)) {
    json_response(['status' => 'error', 'message' => 'Write something first, or choose What to write.'], 400);
}

$fallback = diary_ai_fallback($existingText, $mood, $mode, $instruction);
$sarvamKey = app_secret('SARVAM_API_KEY');

if ($sarvamKey === '') {
    log_diary_ai_access($conn, $userId, $entryId, 'ask', 'local diary helper', $instruction);
    json_response(['status' => 'success', 'suggestion' => $fallback, 'provider' => 'local diary helper']);
}

$prompt = "You are a private personal diary companion, like a loyal close friend who reads carefully and talks honestly. " .
    "Do not mention trading, markets, money, finance, or accounting unless the user's diary text explicitly asks. " .
    "Never erase or contradict the user's existing diary. " .
    "For writing modes, return first-person diary text the user can paste directly. " .
    "For entry_chat, answer the user's exact question about the diary entry. Explain what is written, suggest what to do, rewrite/modify/improve the diary, or discuss any part of it as requested. " .
    "For companion, tease_flirt, weekly_summary, and monthly_summary, speak directly to the user like a warm caring sibling or close friend: supportive, conversational, detailed, and emotionally present. " .
    "For weekly_summary and monthly_summary, deeply read all entries, mention the actual topics and repeated lines from the diary, explain what the user seems to be carrying, console them, and give long practical guidance. " .
    "Do not be generic. If the user wrote about study failure, exams, code, family, business, fear, procrastination, loneliness, or confusion, respond to those exact things. " .
    "Give emotional support, practical suggestions, firm counsel, and occasional gentle scolding when the user is avoiding the obvious next step. Keep the scolding caring, never insulting, shaming, or cruel. " .
    "When giving advice, include what they can do, what they must do, what they should stop doing, and a simple plan for today. " .
    "Explain your understanding in your own words before advising. " .
    "Avoid medical, legal, financial, or therapy claims. " .
    "Light teasing or flirting must stay kind, non-sexual, and only appear when the entry is not about grief, danger, self-harm, abuse, or severe distress. " .
    "Never reveal or repeat the extra instruction. " .
    "When mood is sad or mode is today_sadness, write today's sadness as the user, in first person, with honest feeling. " .
    "Mood: $mood. Mode: $mode. User question/request: $instruction.\n\nDiary entry:\n$existingText";

$response = curl_json('https://api.sarvam.ai/v1/chat/completions', [
    'method' => 'POST',
        'headers' => [
            'Content-Type: application/json',
            'api-subscription-key: ' . $sarvamKey,
        ],
    'body' => [
        'model' => app_secret('SARVAM_MODEL') ?: 'sarvam-30b',
        'messages' => [
            ['role' => 'system', 'content' => 'Answer like a close friend and diary companion. Read the diary carefully, directly address what the user wrote, console them, explain the pattern, and give practical next steps. Be detailed. You may gently scold avoidance, but stay caring and respectful. Do not give medical, legal, or financial advice. Keep playful/flirty language kind, mild, and non-sexual.'],
            ['role' => 'user', 'content' => $prompt],
        ],
        'temperature' => 0.78,
        'top_p' => 1,
        'max_tokens' => 950,
    ],
]);

$suggestion = isset($response['_error']) ? '' : trim($response['choices'][0]['message']['content'] ?? '');
if ($suggestion === '') {
    $suggestion = $fallback;
    $provider = 'local diary helper';
} else {
    $provider = 'Sarvam AI';
}

log_diary_ai_access($conn, $userId, $entryId, 'ask', $provider, $instruction);

json_response(['status' => 'success', 'suggestion' => $suggestion, 'provider' => $provider]);

function diary_ai_fallback(string $text, string $mood, string $mode, string $instruction): string {
    $extra = ($instruction !== '' && $mode !== 'weekly_summary' && $mode !== 'monthly_summary') ? " I also want to remember this: $instruction" : '';
    if ($mode === 'idea') {
        return "You could start with one of these:\n\n1. Right now, the feeling I cannot ignore is...\n2. What I wish someone understood is...\n3. The smallest truth I can admit today is...\n4. If this feeling had a color, place, or sound, it would be...\n$extra";
    }
    if ($mode === 'today_sadness') {
        return "Today I feel sad, and I do not want to pretend it is not there. There is a heaviness inside me that keeps following me through the day. I wish I could explain it perfectly, but maybe I do not need perfect words here. I only need the truth: this day hurt, I felt it deeply, and I am writing it down because it mattered to me.$extra";
    }
    if ($mode === 'continue') {
        return "I want to keep going from here with honesty. The feeling of $mood is still sitting inside me, and these are the words I could not say out loud. I am not trying to make it beautiful. I am only trying to make it true.$extra";
    }
    if ($mode === 'soften') {
        return "A gentler version of this thought:\n$text\n\nI am allowed to feel this without being harsh on myself. I can name what happened, breathe, and choose the next small step.$extra";
    }
    if ($mode === 'organize') {
        return "What I feel:\n$mood\n\nWhat happened:\n" . ($text !== '' ? $text : 'I am still finding words for it.') . "\n\nWhat I need now:\nA little patience, clarity, and one kind action for myself.$extra";
    }
    if ($mode === 'letter') {
        return "Dear me,\n\nI know this has been sitting inside you. You do not have to make it perfect to make it real. Start with the truth, then let the rest arrive slowly.\n\n$text$extra";
    }
    if ($mode === 'companion') {
        return "Come here, I understood you. This sounds like your heart has been doing overtime while you still tried to act normal. I am proud of you for writing it instead of swallowing it. Tiny suggestion: breathe once, drink water, and do one small thing that makes tonight easier. And yes, I am lovingly side-eyeing you if you were pretending you are totally fine.$extra";
    }
    if ($mode === 'tease_flirt') {
        return "Okay, listen. You are feeling a lot, but you are also still cute when you overthink. I am not laughing at your pain. I am gently teasing the dramatic little storm in your head. Take one calm breath, hero. Your diary saw everything and still thinks you are worth loving.$extra";
    }
    if ($mode === 'entry_chat') {
        return diary_entry_chat_fallback($text, $mood, $instruction);
    }
    if ($mode === 'weekly_summary' || $mode === 'monthly_summary') {
        $period = $mode === 'weekly_summary' ? 'week' : 'month';
        if (diary_text_mentions_code($text)) {
            return "I read your $period like this: your head is not empty, it is overloaded. You are trying to fix code, understand errors, and still keep moving, but the diary shows frustration because the problem feels bigger than your control.\n\nWhat I understand\nThis is not only an emotional pattern. This is a practical debugging loop. You are probably jumping between too many possible causes, and that makes the bug feel personal. It is not personal. It is just a system giving you clues badly.\n\nHonest friend advice\nFirst, calm down enough to stop guessing. Yes, I am gently scolding you here: if you keep changing random code without checking the console, network response, and last working version, you are making the problem bigger. Debugging needs discipline, not panic.\n\nWhat you can do\n1. Write the exact error or broken behavior in one sentence.\n2. Open browser console and network tab before editing anything.\n3. Reproduce the issue with the smallest possible action.\n4. Add one log before and after the suspicious line.\n5. Compare with the last version that worked.\n6. Change one thing only, test, then continue.\n\nWhat you must do\nYou must keep notes of what you tried. Otherwise tomorrow-you will fight the same battle again with zero memory. Save your steps, name the error, and stop treating every bug like a full project collapse.\n\nToday plan\nTake 25 minutes. Pick one bug. Define expected behavior, actual behavior, and the first file to inspect. After that, write one diary line: what did I learn from the bug, even if it is not fixed yet?";
        }
        if (diary_text_mentions_work($text)) {
            return "I read your $period as pressure mixed with hope. You want to do better, but your mind is carrying the fear of being late, failing, or not being ready.\n\nWhat I understand\nYou do not need more self-blame. You need a cleaner system. The diary is not saying you are lazy; it is saying your task feels too big, so your brain keeps trying to escape it.\n\nHonest friend advice\nStart smaller. And yes, little scolding: stop waiting for the perfect mood. Perfect mood is a liar. Begin with the ugly first 10 minutes and let momentum arrive late.\n\nWhat you can do\n1. Pick one subject, task, or chapter.\n2. Set a 20-minute timer.\n3. Make handwritten or typed notes of only the important points.\n4. Test yourself with three questions.\n5. Write what confused you and ask for help on that exact part.\n\nWhat you must do\nYou must protect your attention. Put the phone away, close extra tabs, and stop negotiating with distractions like they are your boss.\n\nToday plan\nOne focused block, one tiny result, one short diary update. That is enough to restart trust with yourself.";
        }
        return "I read your $period and the main thing I notice is that your feelings are not random. Something has been repeating inside you, and your diary is trying to make you look at it honestly.\n\nWhat I understand\nThere is a pattern here: a thought, a responsibility, a person, a fear, or an unfinished task keeps coming back. Your mind is asking for clarity. You do not have to solve your whole life today, but you do need to stop ignoring the one thing that keeps knocking.\n\nHonest friend advice\nBe kind to yourself, but do not become too comfortable with avoidance. I am saying this with care: if you already know the next small step and you keep postponing it, you are not confused anymore, you are scared. That is okay. Start scared.\n\nWhat you can do\n1. Name the repeated issue in one sentence.\n2. Write what you can control and what you cannot.\n3. Pick one action small enough to do today.\n4. Tell one trusted person if support would help.\n5. Return tonight and write what changed.\n\nWhat you must do\nYou must stop treating emotions like enemies. They are signals. Listen, decide, act gently, and do not abandon yourself after one hard day.";
    }
    return "The emotion underneath this feels real. I may be feeling $mood, and these words matter because they show what I have been carrying:\n" . ($text !== '' ? $text : 'I am still searching for the first sentence.') . "$extra";
}

function diary_text_mentions_code(string $text): bool {
    return (bool) preg_match('/\b(code|coding|bug|error|console|project|function|react|php|api|database|server|frontend|backend|compile|build|not working|isn\'t working|isnt working)\b/i', $text);
}

function diary_text_mentions_work(string $text): bool {
    return (bool) preg_match('/\b(study|exam|work|task|job|assignment|deadline|learn|practice|meeting|office)\b/i', $text);
}

function diary_entry_chat_fallback(string $text, string $mood, string $instruction): string {
    $ask = strtolower($instruction);
    $summary = diary_short_summary($text);

    if (preg_match('/\b(explain|what is written|inside|meaning|understand)\b/i', $ask)) {
        return "Here is what your diary is saying:\n\n$summary\n\nThe mood around it feels like $mood. The important part is that this entry is pointing to something you want understood clearly, not brushed aside.";
    }

    if (preg_match('/\b(rewrite|modify|change|better|clearer|improve)\b/i', $ask)) {
        return "A clearer version:\n\n" . ($text !== '' ? $text : 'I am trying to understand what I feel and what I should do next.') . "\n\nYou can ask me to make it shorter, more emotional, more mature, more poetic, or more direct.";
    }

    if (preg_match('/\b(suggest|what should|next|smart|do)\b/i', $ask)) {
        if (diary_text_mentions_code($text)) {
            return "Smart next steps:\n\n1. Write the exact error or broken behavior.\n2. Check the browser console, network tab, and backend response.\n3. Reproduce the bug with the smallest possible example.\n4. Add one log before and after the suspicious line.\n5. Change one thing at a time.\n\nDebug like a detective: one clue, one test, one fix.";
        }

        return "What you can do next:\n\n1. Name the real issue in one sentence.\n2. Pick one action small enough to do today.\n3. Write what support, courage, or clarity you need.\n4. Come back and update the diary after doing it.\n\nSmart move: one clean step first, then the next.";
    }

    return "I read this entry as:\n\n$summary\n\nAsk me for a deeper explanation, practical suggestions, a rewrite, or a smarter version and I will work directly from what you wrote.";
}

function diary_short_summary(string $text): string {
    $clean = trim(preg_replace('/\s+/', ' ', $text));
    if ($clean === '') {
        return 'There is not enough written yet to explain deeply.';
    }
    return strlen($clean) > 320 ? substr($clean, 0, 320) . '...' : $clean;
}
?>
