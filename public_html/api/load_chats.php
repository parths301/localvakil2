<?php
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/db_connect.php';
require_once __DIR__ . '/../includes/functions.php';

session_start_secure();

header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Authentication required.']);
    exit;
}
$user_id = $_SESSION['user_id'];

// Determine action: 'list_chats' or 'get_chat_messages'
$action = $_GET['action'] ?? null;
$chat_id_to_load = isset($_GET['chat_id']) ? (int)$_GET['chat_id'] : null;

// CSRF token for GET requests can be tricky. 
// For simplicity, we might rely on session-based auth for read-only operations like this.
// If CSRF is strictly needed for GET, it would typically be passed as a query parameter.
// For now, we'll proceed without CSRF for this read-only endpoint, but consider implications.

// When listing chats, filter by subject_id if provided
if ($action === 'list_chats') {
    $subject_id = isset($_GET['subject_id']) ? intval($_GET['subject_id']) : null;
    
    $query = "SELECT id, title, created_at FROM chats WHERE user_id = ?";
    $params = [$user_id];
    $types = "i";
    
    if ($subject_id) {
        $query .= " AND subject_id = ?";
        $params[] = $subject_id;
        $types .= "i";
    }
    
    $query .= " ORDER BY created_at DESC";
    
    $stmt = $mysqli->prepare($query);
    $stmt->bind_param($types, ...$params);
    if (!$stmt->execute()) {
        error_log("MySQLi execute error (list_chats): " . $stmt->error);
        echo json_encode(['success' => false, 'message' => 'Failed to load chats.']);
        exit;
    }
    $result = $stmt->get_result();
    $chats = [];
    while ($row = $result->fetch_assoc()) {
        $chats[] = $row;
    }
    $stmt->close();
    echo json_encode(['success' => true, 'chats' => $chats]);

} elseif ($action === 'get_chat_messages' && $chat_id_to_load !== null) {
    // First, verify the user owns this chat
    $stmt_verify = $mysqli->prepare("SELECT id FROM chats WHERE id = ? AND user_id = ?");
    if (!$stmt_verify) {
        error_log("MySQLi prepare error (verify chat ownership): " . $mysqli->error);
        echo json_encode(['success' => false, 'message' => 'Database error.']);
        exit;
    }
    $stmt_verify->bind_param("ii", $chat_id_to_load, $user_id);
    $stmt_verify->execute();
    $result_verify = $stmt_verify->get_result();
    if ($result_verify->num_rows === 0) {
        echo json_encode(['success' => false, 'message' => 'Chat not found or access denied.']);
        $stmt_verify->close();
        exit;
    }
    $stmt_verify->close();

    // Fetch messages for the verified chat
    $stmt_msgs = $mysqli->prepare("SELECT sender, message_text, timestamp FROM chat_messages WHERE chat_id = ? ORDER BY timestamp ASC");
    if (!$stmt_msgs) {
        error_log("MySQLi prepare error (get_chat_messages): " . $mysqli->error);
        echo json_encode(['success' => false, 'message' => 'Database error.']);
        exit;
    }
    $stmt_msgs->bind_param("i", $chat_id_to_load);
    if (!$stmt_msgs->execute()) {
        error_log("MySQLi execute error (get_chat_messages): " . $stmt_msgs->error);
        echo json_encode(['success' => false, 'message' => 'Failed to load messages.']);
        exit;
    }
    $result_msgs = $stmt_msgs->get_result();
    $messages = [];
    while ($row = $result_msgs->fetch_assoc()) {
        $messages[] = $row;
    }
    $stmt_msgs->close();
    echo json_encode(['success' => true, 'messages' => $messages]);

} else {
    echo json_encode(['success' => false, 'message' => 'Invalid action or missing chat_id.']);
}

$mysqli->close();
exit;
?>