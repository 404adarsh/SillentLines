<?php
// Backward-compatible login endpoint. The app's canonical user table is
// diaryusers, so keep older frontend calls on the same creation/update path.
require_once __DIR__ . '/ensure_user.php';
?>
