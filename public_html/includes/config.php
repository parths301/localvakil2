<?php
// Site Configuration

define('SITE_URL', 'https://localvakil.com'); // Your domain with https

// Database Credentials
define('DB_HOST', 'localhost:3306');
define('DB_USER', 'vasgxhsj_lv'); // Replace with actual username
define('DB_PASS', 'Pendos-xavmob-juhdy9'); // Replace with actual password
define('DB_NAME', 'vasgxhsj_wp869');

// Google OAuth Credentials
define('GOOGLE_CLIENT_ID', '455482512392-fldtr9ol4srk1tk69fbig8um4t974fus.apps.googleusercontent.com');
define('GOOGLE_CLIENT_SECRET', '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');
define('GOOGLE_REDIRECT_URI', SITE_URL . '/oauth2callback.php'); // Updated path

// Encryption Key Path (Absolute path on your server)
// IMPORTANT: Ensure this path is correct and the file exists and is readable by the web server user,
// but NOT publicly accessible via the web.
// The cPanel username is assumed to be 'vasgxhsj'. If it's different, update the path.
define('ENCRYPTION_KEY_PATH', '/home/vasgxhsj/config_lv/encryption.key');

// Google AI Model
define('GOOGLE_AI_MODEL', 'gemini-1.5-pro-latest'); // Or 'gemini-1.5-pro-preview-0514' or the current valid one

// Error Reporting (for development; set to 0 for production)
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Start session if not already started
if (session_status() == PHP_SESSION_NONE) {
    session_start();
}

// Base path for includes (useful for file system paths)
// Assumes config.php is in public_html/includes/
define('BASE_PATH', dirname(__DIR__)); // This will be /Users/parthsharma/coding/localvakil2/public_html

?>