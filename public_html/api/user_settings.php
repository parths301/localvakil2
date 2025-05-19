<?php
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/db_connect.php';
require_once __DIR__ . '/../includes/functions.php';

session_start_secure();

header('Content-Type: application/json');

// --- 1. Check if user is logged in ---
if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Authentication required. Please login.']);
    exit;
}

// --- 2. Check request method (should be POST) ---
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method.']);
    exit;
}

// --- 3. Get and validate CSRF token --- 
$input = json_decode(file_get_contents('php://input'), true);

// Ensure input is decoded before accessing csrf_token
if (!$input || !isset($input['csrf_token'])) {
    echo json_encode(['success' => false, 'message' => 'CSRF token not provided.']);
    exit;
}

if (!verify_csrf_token($input['csrf_token'])) { 
    echo json_encode(['success' => false, 'message' => 'Invalid CSRF token. Request blocked.']);
    exit;
}

// --- 4. Get JSON input (already done for CSRF token) ---
// $input = json_decode(file_get_contents('php://input'), true); // This line is now redundant

if (!isset($input['api_key'])) { // Check for api_key after CSRF validation
    echo json_encode(['success' => false, 'message' => 'API key not provided.']);
    exit;
}

$api_key_plain = trim($input['api_key']);

if (empty($api_key_plain)) {
    echo json_encode(['success' => false, 'message' => 'API key cannot be empty.']);
    exit;
}

// --- 5. Encrypt the API Key ---
$encryption_key_path = ENCRYPTION_KEY_PATH;
if (!file_exists($encryption_key_path)) {
    error_log('Encryption key file not found at: ' . $encryption_key_path);
    echo json_encode(['success' => false, 'message' => 'Server configuration error (key file).']);
    exit;
}
$key = file_get_contents($encryption_key_path);
if ($key === false || empty(trim($key))) {
    error_log('Encryption key is empty or could not be read from: ' . $encryption_key_path);
    echo json_encode(['success' => false, 'message' => 'Server configuration error (key content).']);
    exit;
}

$encrypted_api_key = encrypt_data($api_key_plain, $key);
if ($encrypted_api_key === false) {
    error_log('API key encryption failed for user_id: ' . $_SESSION['user_id']);
    echo json_encode(['success' => false, 'message' => 'Failed to secure API key.']);
    exit;
}

// --- 6. Update database ---
$user_id = $_SESSION['user_id'];

$stmt = $mysqli->prepare("UPDATE users SET encrypted_api_key = ?, updated_at = NOW() WHERE id = ?");
if (!$stmt) {
    error_log("MySQLi prepare error (update API key): " . $mysqli->error);
    echo json_encode(['success' => false, 'message' => 'Database error. Could not save API key.']);
    exit;
}

$stmt->bind_param("si", $encrypted_api_key, $user_id);

if ($stmt->execute()) {
    if ($stmt->affected_rows > 0) {
        echo json_encode(['success' => true, 'message' => 'API Key saved successfully!']);
    } else {
        // This could happen if the key was the same as already stored, or user ID not found (though unlikely if session is valid)
        echo json_encode(['success' => true, 'message' => 'API Key is current or no changes made.']);
    }
} else {
    error_log("MySQLi execute error (update API key): " . $stmt->error);
    echo json_encode(['success' => false, 'message' => 'Failed to save API key to database.']);
}

$stmt->close();
$mysqli->close();
exit;
?>