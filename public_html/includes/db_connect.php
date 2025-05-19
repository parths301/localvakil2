<?php
// Ensure config.php is included. 
// It's good practice to use require_once to prevent multiple inclusions 
// and to ensure the script stops if config.php is missing.
require_once __DIR__ . '/config.php';

$mysqli = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);

// Check connection
if ($mysqli->connect_errno) {
    // Log the error to a file or error tracking system in a production environment
    // For development, you can display it, but be cautious with sensitive info.
    error_log("Failed to connect to MySQL: (" . $mysqli->connect_errno . ") " . $mysqli->connect_error);
    
    // Display a generic error to the user
    die("Sorry, we are experiencing database connection issues. Please try again later.");
}

// Set the character set to utf8mb4 for full Unicode support (recommended)
if (!$mysqli->set_charset("utf8mb4")) {
    error_log("Error loading character set utf8mb4: " . $mysqli->error);
    // Optionally, you could die here as well if charset is critical
}

// The $mysqli object is now available for use in other scripts that include this file.
// Example: require_once 'includes/db_connect.php';
// Then you can use $mysqli->query(...);

?>