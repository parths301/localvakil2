<?php
// google_login.php

require_once __DIR__ . '/../includes/config.php'; // Adjust path to access config.php from auth/ directory

// Construct the Google OAuth URL
$google_oauth_url = 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query([
    'client_id' => GOOGLE_CLIENT_ID,
    'redirect_uri' => GOOGLE_REDIRECT_URI, // This should be https://localvakil.com/oauth2callback.php or https://localvakil.com/auth/oauth2callback.php based on your final decision
    'response_type' => 'code',
    'scope' => 'openid email profile', // Request basic profile info and email
    'access_type' => 'offline', // Optional: if you need refresh tokens for long-term access (not strictly needed for basic login)
    'prompt' => 'select_account' // Optional: forces account selection even if user is already logged into one Google account
]);

// Redirect the user to Google's OAuth 2.0 server
header('Location: ' . $google_oauth_url);
exit;

?>