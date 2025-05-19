<?php
require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/includes/functions.php';

session_start_secure();

// Generate CSRF token for forms on this page
$csrf_token = generate_csrf_token(); 

$user_logged_in = isset($_SESSION['user_id']);
$user_name = $user_logged_in ? htmlspecialchars($_SESSION['user_name']) : '';
$user_email = $user_logged_in ? htmlspecialchars($_SESSION['user_email'] ?? '') : '';

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LocalVakil - AI Legal Assistant for Indian Law Students</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="css/style.css">
</head>
<body class="bg-gray-50 font-sans">
    <?php if ($user_logged_in): ?>
        <!-- Mobile Menu Button -->
        <div class="md:hidden fixed top-4 left-4 z-50">
            <button id="mobileMenuButton" class="p-2 rounded-md bg-white shadow-md text-gray-700">
                <i class="fas fa-bars"></i>
            </button>
        </div>

        <!-- Sidebar -->
        <div id="sidebar" class="sidebar w-64 bg-white shadow-md fixed h-full overflow-y-auto">
            <div class="p-4 border-b border-gray-200">
                <div class="flex items-center space-x-2">
                    <i class="fas fa-balance-scale text-blue-600 text-2xl"></i>
                    <h1 class="text-xl font-bold text-gray-800">LocalVakil</h1>
                </div>
                <p class="text-sm text-gray-500 mt-1">AI Legal Assistant for Indian Law Students</p>
            </div>
            
            <!-- User Profile Section -->
            <div id="userProfileSection" class="p-4 border-b border-gray-200">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <i class="fas fa-user text-blue-500"></i>
                    </div>
                    <div>
                        <div id="userName" class="font-medium text-gray-800"><?php echo $user_name; ?></div>
                        <div id="userEmail" class="text-xs text-gray-500"><?php echo $user_email; ?></div>
                    </div>
                </div>
                <div class="mt-3 flex space-x-2">
                    <button id="viewHistoryBtn" class="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded">
                        <i class="fas fa-history mr-1"></i> History
                    </button>
                    <a href="auth/logout.php" class="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded">
                        <i class="fas fa-sign-out-alt mr-1"></i> Logout
                    </a>
                </div>
            </div>
            
            <!-- Chat History Section -->
            <div id="chatHistorySection" class="p-4 border-b border-gray-200">
                <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Recent Chats</h2>
                <div id="chatHistoryList" class="space-y-2">
                    <!-- Chat history items will be added here dynamically -->
                </div>
            </div>
            
            <div class="p-4">
                <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wider">Core Subjects</h2>
                <div class="mt-3 space-y-2">
                    <button class="subject-btn w-full text-left p-2 rounded-md hover:bg-gray-100" data-subject="constitution">
                        <i class="fas fa-landmark mr-2 text-blue-500"></i> Constitutional Law
                    </button>
                    <button class="subject-btn w-full text-left p-2 rounded-md hover:bg-gray-100" data-subject="ipc">
                        <i class="fas fa-gavel mr-2 text-red-500"></i> IPC & CrPC
                    </button>
                    <button class="subject-btn w-full text-left p-2 rounded-md hover:bg-gray-100" data-subject="contract">
                        <i class="fas fa-file-signature mr-2 text-green-500"></i> Contract Law
                    </button>
                    <button class="subject-btn w-full text-left p-2 rounded-md hover:bg-gray-100" data-subject="property">
                        <i class="fas fa-home mr-2 text-yellow-500"></i> Property Law
                    </button>
                </div>
            </div>
        </div>

        <!-- Main Content -->
        <div class="ml-64 flex flex-col min-h-screen">
            <header class="bg-white shadow-sm">
                <div class="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                    <h1 class="text-lg font-semibold text-gray-900">LocalVakil Chat</h1>
                    <button id="user-settings-link" class="text-gray-500 hover:text-gray-700">
                        <i class="fas fa-cog"></i>
                    </button>
                </div>
            </header>

            <main class="flex-1">
                <?php display_session_messages(); ?>
                
                <div class="chat-container flex flex-col h-full">
                    <div class="flex-1 overflow-hidden">
                        <!-- Chat Messages Area -->
                        <div class="flex-1 flex flex-col">
                            <div id="chat-messages-area" class="flex-1 overflow-y-auto p-4 space-y-4">
                                <!-- Messages will appear here -->
                                <div class="flex justify-center items-center h-full">
                                    <p class="text-gray-500">Select a chat to view messages or start a new one.</p>
                                </div>
                            </div>
                            
                            <!-- Message Input Form -->
                            <form id="chat-message-form" class="p-4 border-t border-gray-200">
                                <input type="hidden" name="csrf_token_chat" value="<?php echo htmlspecialchars($csrf_token); ?>">
                                <div class="flex space-x-2">
                                    <textarea id="message-input" class="flex-1 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Type your message..."></textarea>
                                    <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors">
                                        <i class="fas fa-paper-plane"></i>
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    <?php else: ?>
        <!-- Login Page -->
        <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div class="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-md">
                <div class="text-center">
                    <i class="fas fa-balance-scale text-blue-600 text-5xl mb-4"></i>
                    <h2 class="mt-6 text-3xl font-extrabold text-gray-900">Welcome to LocalVakil</h2>
                    <p class="mt-2 text-sm text-gray-600">AI Legal Assistant for Indian Law Students</p>
                </div>
                
                <div class="mt-8 space-y-6">
                    <div class="rounded-md shadow-sm space-y-4">
                        <div>
                            <a href="auth/google_login.php" class="group relative w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                                <span class="absolute left-0 inset-y-0 flex items-center pl-3">
                                    <i class="fab fa-google text-blue-600"></i>
                                </span>
                                Login with Google
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    <?php endif; ?>

    <?php if ($user_logged_in): ?>
        <!-- User Settings Modal -->
        <div id="user-settings-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden">
            <div class="bg-white rounded-lg shadow-xl w-full max-w-md">
                <div class="flex justify-between items-center border-b border-gray-200 px-6 py-4">
                    <h2 class="text-xl font-semibold text-gray-800">User Settings</h2>
                    <button class="text-gray-500 hover:text-gray-700" id="close-settings">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="p-6">
                    <form id="api-key-form">
                        <input type="hidden" name="csrf_token_settings" value="<?php echo htmlspecialchars($csrf_token); ?>">
                        <div class="mb-4">
                            <label class="block text-gray-700 text-sm font-medium mb-2" for="api_key">Google AI Studio API Key</label>
                            <input type="text" id="api_key" name="api_key" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                        </div>
                        <div class="flex justify-end">
                            <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors">
                                Save Key
                            </button>
                        </div>
                        <p id="api-key-status" class="mt-3 text-sm"></p>
                    </form>
                </div>
            </div>
        </div>
    <?php endif; ?>

    <script src="js/app.js"></script>
</body>
</html>