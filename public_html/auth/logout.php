<?php
require_once __DIR__ . '/../includes/config.php'; // For SITE_URL
require_once __DIR__ . '/../includes/functions.php'; // For session_start_secure() and redirect()

session_start_secure();

// Unset all of the session variables.
$_SESSION = [];

// If it's desired to kill the session, also delete the session cookie.
// Note: This will destroy the session, and not just the session data!
if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000,
        $params["path"], $params["domain"],
        $params["secure"], $params["httponly"]
    );
}

// Finally, destroy the session.
session_destroy();

// Set a success message (optional)
// We can't use $_SESSION here as it's destroyed, so we'll use a query parameter if needed,
// or just rely on the user seeing they are logged out on the homepage.
// For simplicity, we'll just redirect.

redirect(SITE_URL . '/index.php'); // Redirect to homepage
exit;
?>