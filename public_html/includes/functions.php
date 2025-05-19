<?php
// functions.php

// Ensure config.php is loaded, as it contains ENCRYPTION_KEY_PATH and starts sessions
require_once __DIR__ . '/config.php';

// --- Encryption/Decryption Functions for API Keys ---

/**
 * Retrieves the master encryption key from the file specified in config.php.
 * Dies with an error if the key file is not found or not readable.
 * @return string The encryption key.
 */
function get_encryption_key() {
    if (!defined('ENCRYPTION_KEY_PATH')) {
        error_log('ENCRYPTION_KEY_PATH is not defined in config.php');
        die('Critical configuration error: Encryption key path not set.');
    }
    if (!file_exists(ENCRYPTION_KEY_PATH) || !is_readable(ENCRYPTION_KEY_PATH)) {
        error_log('Encryption key file not found or not readable at: ' . ENCRYPTION_KEY_PATH);
        // IMPORTANT: Do NOT reveal the path to the user in a live environment.
        // This detailed error is for server logs.
        die('Critical security error: Could not load encryption key. Please contact administrator.');
    }
    $key = trim(file_get_contents(ENCRYPTION_KEY_PATH));
    if (empty($key)) {
        error_log('Encryption key file is empty at: ' . ENCRYPTION_KEY_PATH);
        die('Critical security error: Encryption key is empty. Please contact administrator.');
    }
    // Ensure the key is of a minimum length if desired, e.g., 32 bytes for AES-256
    if (strlen($key) < 32) {
        error_log('Encryption key is too short. Must be at least 32 bytes. Path: ' . ENCRYPTION_KEY_PATH);
        die('Critical security error: Encryption key is not strong enough. Please contact administrator.');
    }
    return $key;
}

/**
 * Encrypts a string using AES-256-CBC.
 * @param string $plaintext The string to encrypt.
 * @param string $key The encryption key.
 * @return string|false The encrypted string (hex encoded) or false on failure.
 */
function encrypt_data($plaintext, $key) {
    $cipher = "aes-256-cbc";
    $ivlen = openssl_cipher_iv_length($cipher);
    if ($ivlen === false) {
        error_log('Could not get IV length for cipher: ' . $cipher);
        return false;
    }
    $iv = openssl_random_pseudo_bytes($ivlen);
    $ciphertext_raw = openssl_encrypt($plaintext, $cipher, $key, OPENSSL_RAW_DATA, $iv);
    if ($ciphertext_raw === false) {
        error_log('OpenSSL encryption failed: ' . openssl_error_string());
        return false;
    }
    // Prepend IV to ciphertext for use in decryption, then hex encode for storage
    return bin2hex($iv . $ciphertext_raw);
}

/**
 * Decrypts a string encrypted with encrypt_data().
 * @param string $ciphertext_hex The hex-encoded encrypted string (IV prepended).
 * @param string $key The encryption key.
 * @return string|false The decrypted string or false on failure.
 */
function decrypt_data($ciphertext_hex, $key) {
    $cipher = "aes-256-cbc";
    $ciphertext_bin = hex2bin($ciphertext_hex);
    if ($ciphertext_bin === false) {
        error_log('Failed to hex decode ciphertext.');
        return false;
    }
    
    $ivlen = openssl_cipher_iv_length($cipher);
    if ($ivlen === false) {
        error_log('Could not get IV length for cipher: ' . $cipher);
        return false;
    }
    if (strlen($ciphertext_bin) < $ivlen) {
        error_log('Ciphertext is too short to contain IV.');
        return false;
    }
    $iv = substr($ciphertext_bin, 0, $ivlen);
    $ciphertext_raw = substr($ciphertext_bin, $ivlen);
    
    $plaintext = openssl_decrypt($ciphertext_raw, $cipher, $key, OPENSSL_RAW_DATA, $iv);
    
    if ($plaintext === false) {
        error_log('OpenSSL decryption failed: ' . openssl_error_string());
        return false;
    }
    return $plaintext;
}

// --- CSRF (Cross-Site Request Forgery) Protection Functions ---

/**
 * Generates a CSRF token and stores it in the session.
 * @return string The generated CSRF token.
 */
function generate_csrf_token() {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

/**
 * Validates a CSRF token against the one stored in the session.
 * @param string $token The token to validate (usually from POST data).
 * @return bool True if valid, false otherwise.
 */
function validate_csrf_token($token) {
    if (!empty($_SESSION['csrf_token']) && hash_equals($_SESSION['csrf_token'], $token)) {
        // Token is valid, consume it to prevent reuse (optional, but good practice for some scenarios)
        // unset($_SESSION['csrf_token']); 
        return true;
    }
    return false;
}

/**
 * Outputs a hidden input field with the CSRF token.
 */
function csrf_input_field() {
    echo '<input type="hidden" name="csrf_token" value="' . htmlspecialchars(generate_csrf_token()) . '">';
}

// --- Input Sanitization ---

/**
 * Basic input sanitization for strings to prevent XSS.
 * @param string $data The input data.
 * @return string The sanitized data.
 */
function sanitize_input($data) {
    $data = trim($data);
    $data = stripslashes($data);
    $data = htmlspecialchars($data, ENT_QUOTES, 'UTF-8');
    return $data;
}

// --- User Session Management (Basic Examples) ---

/**
 * Checks if a user is logged in.
 * @return bool True if logged in, false otherwise.
 */
function is_user_logged_in() {
    return isset($_SESSION['user_id']);
}

/**
 * Redirects to a given URL.
 * @param string $url The URL to redirect to.
 */
function redirect($url) {
    header("Location: " . $url);
    exit;
}

// --- Other Helper Functions (Add as needed) ---

/**
 * Helper to safely get a value from POST array.
 * @param string $key The key to look for in $_POST.
 * @param mixed $default The default value if key is not found.
 * @return mixed The value from $_POST or default.
 */
function get_post_var($key, $default = null) {
    return isset($_POST[$key]) ? $_POST[$key] : $default;
}

/**
 * Helper to safely get a value from GET array.
 * @param string $key The key to look for in $_GET.
 * @param mixed $default The default value if key is not found.
 * @return mixed The value from $_GET or default.
 */
function get_get_var($key, $default = null) {
    return isset($_GET[$key]) ? $_GET[$key] : $default;
}

/**
 * Starts a secure session with proper configuration
 */
function session_start_secure() {
    // Check if session is already active
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    // Ensure cookies are only sent over HTTPS in production
    $secure = ($_SERVER['HTTPS'] ?? 'off') === 'on';
    $httponly = true;
    $samesite = 'Lax';

    // Set session cookie parameters before starting
    session_set_cookie_params([
        'lifetime' => 86400, // 1 day
        'path' => '/',
        'domain' => $_SERVER['HTTP_HOST'],
        'secure' => $secure,
        'httponly' => $httponly,
        'samesite' => $samesite
    ]);

    // Start the session if not already active
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }

    // Regenerate session ID to prevent session fixation
    if (empty($_SESSION['initiated']) && !headers_sent()) {
        session_regenerate_id(true);
        $_SESSION['initiated'] = true;
    }
}

/**
 * Displays session messages and clears them after display
 */
function display_session_messages() {
    if (!empty($_SESSION['messages'])) {
        echo '<div class="session-messages">';
        foreach ($_SESSION['messages'] as $message) {
            echo '<div class="message ' . htmlspecialchars($message['type']) . '">' 
                . htmlspecialchars($message['text']) . '</div>';
        }
        echo '</div>';
        // Clear messages after displaying
        unset($_SESSION['messages']);
    }
}

/**
 * Adds a message to be displayed on next page load
 * @param string $text The message text
 * @param string $type The message type (error, success, warning, info)
 */
function add_session_message($text, $type = 'info') {
    if (!isset($_SESSION['messages'])) {
        $_SESSION['messages'] = [];
    }
    $_SESSION['messages'][] = [
        'text' => $text,
        'type' => $type
    ];
}

?>