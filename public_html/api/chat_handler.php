<?php
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/db_connect.php';
require_once __DIR__ . '/../includes/functions.php';

session_start_secure();

header('Content-Type: application/json');

// --- 1. Authenticate User & Check Request Method ---
if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Authentication required.']);
    exit;
}
$user_id = $_SESSION['user_id'];

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method.']);
    exit;
}

// --- 2. Get and Validate Input (user message, chat_id) ---
$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['message']) || empty(trim($input['message']))) {
    echo json_encode(['success' => false, 'message' => 'Message cannot be empty.']);
    exit;
}
$user_message_text = trim($input['message']);

// chat_id can be null for a new chat, or an existing ID
$chat_id = isset($input['chat_id']) ? (int)$input['chat_id'] : null;
$new_chat_title = null;

// --- 3. Validate CSRF Token (implement as in user_settings.php) ---
if (!isset($input['csrf_token']) || !verify_csrf_token($input['csrf_token'])) {
    echo json_encode(['success' => false, 'message' => 'Invalid CSRF token. Request blocked.']);
    exit;
}

// --- 4. Retrieve User's Decrypted API Key ---
$stmt_api_key = $mysqli->prepare("SELECT encrypted_api_key FROM users WHERE id = ?");
if (!$stmt_api_key) {
    error_log("MySQLi prepare error (get API key): " . $mysqli->error);
    echo json_encode(['success' => false, 'message' => 'Database error preparing to fetch API key.']);
    exit;
}
$stmt_api_key->bind_param("i", $user_id);
$stmt_api_key->execute();
$result_api_key = $stmt_api_key->get_result();
if ($result_api_key->num_rows === 0) {
    echo json_encode(['success' => false, 'message' => 'User not found or API key not set up.']);
    $stmt_api_key->close();
    exit;
}
$user_data = $result_api_key->fetch_assoc();
$stmt_api_key->close();

if (empty($user_data['encrypted_api_key'])) {
    echo json_encode(['success' => false, 'message' => 'Google AI API Key is not set. Please set it in your user settings.']);
    exit;
}

$encryption_key = file_get_contents(ENCRYPTION_KEY_PATH);
if ($encryption_key === false || empty(trim($encryption_key))) {
    error_log('Encryption key is empty or could not be read from: ' . ENCRYPTION_KEY_PATH);
    echo json_encode(['success' => false, 'message' => 'Server configuration error (key content).']);
    exit;
}

$google_ai_api_key = decrypt_data($user_data['encrypted_api_key'], $encryption_key);
if ($google_ai_api_key === false) {
    error_log('Failed to decrypt API key for user_id: ' . $user_id);
    echo json_encode(['success' => false, 'message' => 'Failed to access API key. Check server logs.']);
    exit;
}

// --- 5. Handle Chat Creation or Continuation ---
$mysqli->begin_transaction();

try {
    if ($chat_id === null) { // New chat
        // Create a title for the new chat (e.g., first few words of the message)
        $new_chat_title = mb_substr($user_message_text, 0, 50);
        if (mb_strlen($user_message_text) > 50) {
            $new_chat_title .= '...';
        }

        // When creating a new chat, include the subject_id
        $subject_id = isset($input['subject_id']) ? intval($input['subject_id']) : null; // Changed from $_POST to $input
        // Remove this duplicate statement
        // $stmt = $mysqli->prepare("INSERT INTO chats (user_id, subject_id, title) VALUES (?, ?, ?)");
        // $stmt->bind_param("iis", $user_id, $subject_id, $chat_title);
        
        $stmt_new_chat = $mysqli->prepare("INSERT INTO chats (user_id, subject_id, title, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())");
        if (!$stmt_new_chat) throw new Exception("MySQLi prepare error (new chat): " . $mysqli->error);
        $stmt_new_chat->bind_param("iis", $user_id, $subject_id, $new_chat_title);
        if (!$stmt_new_chat->execute()) throw new Exception("MySQLi execute error (new chat): " . $stmt_new_chat->error);
        $chat_id = $mysqli->insert_id;
        $stmt_new_chat->close();
    } else { // Existing chat, update its updated_at timestamp
        $stmt_update_chat = $mysqli->prepare("UPDATE chats SET updated_at = NOW() WHERE id = ? AND user_id = ?");
        if (!$stmt_update_chat) throw new Exception("MySQLi prepare error (update chat timestamp): " . $mysqli->error);
        $stmt_update_chat->bind_param("ii", $chat_id, $user_id);
        if (!$stmt_update_chat->execute()) throw new Exception("MySQLi execute error (update chat timestamp): " . $stmt_update_chat->error);
        if ($stmt_update_chat->affected_rows === 0) {
            // This means the chat_id doesn't belong to the user or doesn't exist
            throw new Exception("Chat not found or access denied.");
        }
        $stmt_update_chat->close();
    }

    // --- 6. Save User's Message to Database ---
    $stmt_user_msg = $mysqli->prepare("INSERT INTO chat_messages (chat_id, sender, message_text) VALUES (?, 'user', ?)");
    if (!$stmt_user_msg) throw new Exception("MySQLi prepare error (user message): " . $mysqli->error);
    $stmt_user_msg->bind_param("is", $chat_id, $user_message_text);
    if (!$stmt_user_msg->execute()) throw new Exception("MySQLi execute error (user message): " . $stmt_user_msg->error);
    $stmt_user_msg->close();

    // --- 7. Prepare Payload and Call Google AI API ---
    // For Gemini, the typical endpoint is like: 
    // https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=YOUR_API_KEY
    // The payload structure is specific to the model.
    // We'll need to construct the 'contents' array, potentially including history.

    // For simplicity, let's assume a basic call without history for now.
    // You'll need to consult the Google AI Studio / Gemini API documentation for the exact payload.
    $google_api_url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" . $google_ai_api_key;
    
    $payload = [
        'contents' => [
            [
                'parts' => [
                    ['text' => $user_message_text]
                ]
            ]
        ]
        // Add 'generationConfig' and 'safetySettings' as needed
    ];

    $ch = curl_init($google_api_url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 60); // 60 seconds timeout

    $api_response_json = curl_exec($ch);
    $curl_error = curl_error($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($curl_error) {
        throw new Exception("cURL Error calling Google AI: " . $curl_error);
    }

    $api_response_data = json_decode($api_response_json, true);

    if ($http_code !== 200 || !$api_response_data || !isset($api_response_data['candidates'][0]['content']['parts'][0]['text'])) {
        // Log the actual response for debugging
        error_log("Google AI API Error (HTTP {$http_code}): " . $api_response_json);
        throw new Exception("Failed to get a valid response from Google AI. HTTP Status: {$http_code}. Response: " . $api_response_json);
    }

    $ai_message_text = $api_response_data['candidates'][0]['content']['parts'][0]['text'];

    // --- 8. Save AI's Message to Database ---
    $stmt_ai_msg = $mysqli->prepare("INSERT INTO chat_messages (chat_id, sender, message_text) VALUES (?, 'ai', ?)");
    if (!$stmt_ai_msg) throw new Exception("MySQLi prepare error (AI message): " . $mysqli->error);
    $stmt_ai_msg->bind_param("is", $chat_id, $ai_message_text);
    if (!$stmt_ai_msg->execute()) throw new Exception("MySQLi execute error (AI message): " . $stmt_ai_msg->error);
    $stmt_ai_msg->close();

    $mysqli->commit();

    // --- 9. Return AI's Response (and new chat_id if created) ---
    $response_payload = [
        'success' => true, 
        'ai_message' => $ai_message_text,
        'chat_id' => $chat_id // Send back the chat_id (new or existing)
    ];
    if ($new_chat_title) {
        $response_payload['new_chat_title'] = $new_chat_title;
    }
    echo json_encode($response_payload);

} catch (Exception $e) {
    $mysqli->rollback();
    error_log("Chat Handler Exception: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'An error occurred: ' . $e->getMessage()]);
}

$mysqli->close();
exit;
?>