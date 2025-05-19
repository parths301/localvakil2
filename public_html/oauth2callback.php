<?php
// oauth2callback.php

require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/includes/db_connect.php'; // <-- This line should be present
require_once __DIR__ . '/includes/functions.php';

// Add this check right after includes
if (!isset($mysqli) || !$mysqli instanceof mysqli || $mysqli->connect_errno) {
    error_log("Database connection failed in oauth2callback.php");
    $_SESSION['error_message'] = 'Database connection error. Please try again.';
    redirect(SITE_URL . '/index.php');
    exit;
}

// --- 1. Handle the authorization code from Google ---
if (!isset($_GET['code'])) {
    // No authorization code provided by Google, or user denied access
    $_SESSION['error_message'] = 'Google login failed or was cancelled.';
    redirect(SITE_URL . '/index.php'); // Redirect to home page or a login page with an error
    exit;
}

$auth_code = $_GET['code'];

// --- 2. Exchange authorization code for an access token ---
$token_endpoint = 'https://oauth2.googleapis.com/token';
$token_params = [
    'code' => $auth_code,
    'client_id' => GOOGLE_CLIENT_ID,
    'client_secret' => GOOGLE_CLIENT_SECRET,
    'redirect_uri' => GOOGLE_REDIRECT_URI, // Must be the same URI used in the initial auth request
    'grant_type' => 'authorization_code'
];

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $token_endpoint);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($token_params));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/x-www-form-urlencoded']);

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curl_error = curl_error($ch);
curl_close($ch);

if ($http_code !== 200 || $response === false) {
    error_log("Google Token Exchange Failed. HTTP Code: {$http_code}. cURL Error: {$curl_error}. Response: {$response}");
    $_SESSION['error_message'] = 'Failed to authenticate with Google (token exchange). Please try again.';
    redirect(SITE_URL . '/index.php');
    exit;
}

$token_data = json_decode($response, true);

if (!isset($token_data['access_token']) || !isset($token_data['id_token'])) {
    error_log("Google Token Exchange Error: Access token or ID token not found in response. Response: " . $response);
    $_SESSION['error_message'] = 'Authentication error (missing tokens). Please try again.';
    redirect(SITE_URL . '/index.php');
    exit;
}

$access_token = $token_data['access_token'];
// $id_token = $token_data['id_token']; // Contains user info, can be decoded and verified

// --- 3. Use access token to get user profile information ---
$userinfo_endpoint = 'https://www.googleapis.com/oauth2/v3/userinfo';

$ch_user = curl_init();
curl_setopt($ch_user, CURLOPT_URL, $userinfo_endpoint);
curl_setopt($ch_user, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch_user, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $access_token
]);

$userinfo_response = curl_exec($ch_user);
$userinfo_http_code = curl_getinfo($ch_user, CURLINFO_HTTP_CODE);
$userinfo_curl_error = curl_error($ch_user);
curl_close($ch_user);

if ($userinfo_http_code !== 200 || $userinfo_response === false) {
    error_log("Google UserInfo Request Failed. HTTP Code: {$userinfo_http_code}. cURL Error: {$userinfo_curl_error}. Response: {$userinfo_response}");
    $_SESSION['error_message'] = 'Failed to retrieve user information from Google. Please try again.';
    redirect(SITE_URL . '/index.php');
    exit;
}

$user_profile = json_decode($userinfo_response, true);

if (!isset($user_profile['sub']) || !isset($user_profile['email'])) {
    error_log("Google UserInfo Error: Sub (Google ID) or email not found. Response: " . $userinfo_response);
    $_SESSION['error_message'] = 'Could not retrieve essential user details from Google.';
    redirect(SITE_URL . '/index.php');
    exit;
}

// --- 4. Process User Data (Check database, create/update user, log them in) ---

$google_id = $user_profile['sub']; // Unique Google User ID
$email = $user_profile['email'];
$name = isset($user_profile['name']) ? $user_profile['name'] : (isset($user_profile['given_name']) ? $user_profile['given_name'] : '');
$picture = isset($user_profile['picture']) ? $user_profile['picture'] : null;

// At this point, you need your 'users' table schema.
// Let's assume your users table has columns like:
// id (INT, PK, AI), google_id (VARCHAR, UNIQUE), email (VARCHAR, UNIQUE), name (VARCHAR), 
// profile_picture_url (VARCHAR), encrypted_api_key (TEXT), created_at (TIMESTAMP), updated_at (TIMESTAMP)

// Check if user already exists by google_id
$stmt = $mysqli->prepare("SELECT id, email, name FROM users WHERE google_id = ?");
if (!$stmt) {
    error_log("MySQLi prepare error (select user): " . $mysqli->error);
    $_SESSION['error_message'] = 'Database error during login. Please try again.';
    redirect(SITE_URL . '/index.php');
    exit;
}
$stmt->bind_param("s", $google_id);
$stmt->execute();
$result = $stmt->get_result();
$existing_user = $result->fetch_assoc();
$stmt->close();

$user_id = null;

if ($existing_user) {
    // User exists, log them in
    $user_id = $existing_user['id'];
    // Optionally, update their name or profile picture if it has changed
    $update_stmt = $mysqli->prepare("UPDATE users SET name = ?, email = ?, profile_picture_url = ?, updated_at = NOW() WHERE id = ?");
    if ($update_stmt) {
        $update_stmt->bind_param("sssi", $name, $email, $picture, $user_id);
        $update_stmt->execute();
        $update_stmt->close();
    } else {
        error_log("MySQLi prepare error (update user): " . $mysqli->error);
        // Non-critical, proceed with login
    }
} else {
    // User does not exist, create a new user record
    $insert_stmt = $mysqli->prepare("INSERT INTO users (google_id, email, name, profile_picture_url, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())");
    if (!$insert_stmt) {
        error_log("MySQLi prepare error (insert user): " . $mysqli->error);
        $_SESSION['error_message'] = 'Database error during registration. Please try again.';
        redirect(SITE_URL . '/index.php');
        exit;
    }
    $insert_stmt->bind_param("ssss", $google_id, $email, $name, $picture);
    if ($insert_stmt->execute()) {
        $user_id = $insert_stmt->insert_id;
    } else {
        error_log("MySQLi execute error (insert user): " . $insert_stmt->error);
        // Check for duplicate email if you have a unique constraint on email and google_id is different
        if ($mysqli->errno == 1062) { // 1062 is error code for duplicate entry
             $_SESSION['error_message'] = 'An account with this email already exists. Please log in with the original method.';
        } else {
            $_SESSION['error_message'] = 'Failed to create your account. Please try again.';
        }
        $insert_stmt->close();
        redirect(SITE_URL . '/index.php');
        exit;
    }
    $insert_stmt->close();
}

if ($user_id) {
    // --- 5. Establish Session for the User ---
    $_SESSION['user_id'] = $user_id;
    $_SESSION['user_name'] = $name;
    $_SESSION['user_email'] = $email;
    $_SESSION['user_picture'] = $picture;
    $_SESSION['success_message'] = 'Successfully logged in with Google!';
    
    // Regenerate session ID for security after login
    session_regenerate_id(true);

    redirect(SITE_URL . '/index.php'); // Redirect to the main page or user dashboard
    exit;
} else {
    $_SESSION['error_message'] = 'Login failed after processing user data. Please try again.';
    redirect(SITE_URL . '/index.php');
    exit;
}

?>