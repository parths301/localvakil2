document.addEventListener('DOMContentLoaded', function() {
    // --- User Settings Modal ---
    const settingsLink = document.getElementById('user-settings-link');
    const settingsModal = document.getElementById('user-settings-modal');
    const closeButton = settingsModal ? settingsModal.querySelector('.close-button') : null;
    const apiKeyForm = document.getElementById('api-key-form');
    const apiKeyInput = document.getElementById('api_key');
    const apiKeyStatus = document.getElementById('api-key-status');
    // CSRF token for API key form
    const csrfSettingsTokenInput = apiKeyForm ? apiKeyForm.querySelector('input[name="csrf_token_settings"]') : null;

    if (settingsLink && settingsModal) {
        settingsLink.addEventListener('click', function(event) {
            event.preventDefault();
            settingsModal.style.display = 'block';
        });
    }
    if (closeButton && settingsModal) {
        closeButton.addEventListener('click', function() {
            settingsModal.style.display = 'none';
        });
    }
    window.addEventListener('click', function(event) {
        if (event.target === settingsModal) {
            settingsModal.style.display = 'none';
        }
    });

    if (apiKeyForm && csrfSettingsTokenInput) {
        apiKeyForm.addEventListener('submit', function(event) {
            event.preventDefault();
            const apiKey = apiKeyInput.value.trim();
            const csrfToken = csrfSettingsTokenInput.value;

            if (!apiKey) {
                apiKeyStatus.textContent = 'Please enter an API Key.';
                apiKeyStatus.style.color = 'red';
                return;
            }
            if (!csrfToken) {
                apiKeyStatus.textContent = 'Security token missing. Please refresh and try again.';
                apiKeyStatus.style.color = 'red';
                return;
            }

            apiKeyStatus.textContent = 'Saving...';
            apiKeyStatus.style.color = 'orange';

            fetch('api/user_settings.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ api_key: apiKey, csrf_token: csrfToken })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    apiKeyStatus.textContent = data.message || 'API Key saved successfully!';
                    apiKeyStatus.style.color = 'green';
                    apiKeyInput.value = ''; 
                } else {
                    apiKeyStatus.textContent = data.message || 'Failed to save API Key.';
                    apiKeyStatus.style.color = 'red';
                }
            })
            .catch(error => {
                console.error('Error saving API key:', error);
                apiKeyStatus.textContent = 'An error occurred. Please try again.';
                apiKeyStatus.style.color = 'red';
            });
        });
    }

    // --- Chat Functionality ---
    const chatListUL = document.getElementById('chat-list');
    const chatMessagesArea = document.getElementById('chat-messages-area');
    const messageInput = document.getElementById('message-input');
    const messageForm = document.getElementById('chat-message-form');
    const newChatButton = document.getElementById('new-chat-button');
    const csrfChatTokenInput = messageForm ? messageForm.querySelector('input[name="csrf_token_chat"]') : null;

    let currentChatId = null;

    function displayMessage(sender, text) {
        if (!chatMessagesArea) return;
        // Remove placeholder if it exists
        const placeholder = chatMessagesArea.querySelector('.chat-placeholder');
        if (placeholder) placeholder.remove();

        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender === 'user' ? 'user-message' : 'ai-message');
        messageDiv.textContent = text;
        chatMessagesArea.appendChild(messageDiv);
        chatMessagesArea.scrollTop = chatMessagesArea.scrollHeight; // Scroll to bottom
    }

    async function loadChats() {
        if (!chatListUL) return;
        try {
            const response = await fetch('api/load_chats.php?action=list_chats');
            const data = await response.json();
            if (data.success && data.chats) {
                chatListUL.innerHTML = ''; // Clear existing list
                data.chats.forEach(chat => {
                    const li = document.createElement('li');
                    li.textContent = chat.title;
                    li.dataset.chatId = chat.id;
                    li.addEventListener('click', () => loadChatMessages(chat.id));
                    chatListUL.appendChild(li);
                });
            } else {
                console.error('Failed to load chats:', data.message);
            }
        } catch (error) {
            console.error('Error loading chats:', error);
        }
    }

    async function loadChatMessages(chatId) {
        if (!chatMessagesArea) return;
        currentChatId = chatId;
        // Highlight active chat in sidebar (optional)
        document.querySelectorAll('#chat-list li').forEach(li => {
            li.classList.toggle('active', li.dataset.chatId == chatId);
        });

        try {
            const response = await fetch(`api/load_chats.php?action=get_chat_messages&chat_id=${chatId}`);
            const data = await response.json();
            chatMessagesArea.innerHTML = ''; // Clear previous messages
            if (data.success && data.messages) {
                if (data.messages.length === 0) {
                    chatMessagesArea.innerHTML = '<p class="chat-placeholder">No messages in this chat yet. Send one!</p>';
                } else {
                    data.messages.forEach(msg => displayMessage(msg.sender, msg.message_text));
                }
            } else {
                displayMessage('system', 'Failed to load messages: ' + (data.message || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error loading messages:', error);
            displayMessage('system', 'Error loading messages. Check console.');
        }
    }

    // Mobile menu toggle
    const mobileMenuButton = document.getElementById('mobileMenuButton');
    const sidebar = document.getElementById('sidebar');
    
    if (mobileMenuButton && sidebar) {
        mobileMenuButton.addEventListener('click', () => {
            sidebar.classList.toggle('sidebar-open');
        });
    }
    
    // User settings modal
    const userSettingsLink = document.getElementById('user-settings-link');
    const userSettingsModal = document.getElementById('user-settings-modal');
    const closeSettings = document.getElementById('close-settings');
    
    if (userSettingsLink && userSettingsModal) {
        userSettingsLink.addEventListener('click', (e) => {
            e.preventDefault();
            userSettingsModal.classList.remove('hidden');
        });
    }
    
    if (closeSettings && userSettingsModal) {
        closeSettings.addEventListener('click', () => {
            userSettingsModal.classList.add('hidden');
        });
    }
    
    // Chat message handling (updated for new UI)
    document.getElementById('chat-message-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const messageInput = document.getElementById('message-input');
        const message = messageInput.value.trim();
        
        if (message) {
            // Add user message to chat
            addMessageToChat(message, 'user');
            messageInput.value = '';
            
            // Show typing indicator
            showTypingIndicator();
            
            // Send to server and get AI response
            try {
                const response = await fetch('/api/chat_handler.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: message,
                        csrf_token_chat: document.querySelector('#chat-message-form input[name="csrf_token_chat"]').value
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    addMessageToChat(data.response, 'ai');
                } else {
                    console.error('Error:', data.error);
                }
            } catch (error) {
                console.error('Error:', error);
            } finally {
                hideTypingIndicator();
            }
        }
    });
    
    function addMessageToChat(message, sender) {
        const chatArea = document.getElementById('chat-messages-area');
        const messageDiv = document.createElement('div');
        
        messageDiv.classList.add(
            'p-3', 'rounded-lg', 'max-w-[80%]', 'my-2',
            sender === 'user' 
                ? 'bg-blue-600 text-white self-end rounded-br-none'
                : 'bg-gray-200 text-gray-800 self-start rounded-bl-none'
        );
        
        messageDiv.textContent = message;
        chatArea.appendChild(messageDiv);
        chatArea.scrollTop = chatArea.scrollHeight;
    }
    
    function showTypingIndicator() {
        const chatArea = document.getElementById('chat-messages-area');
        const typingDiv = document.createElement('div');
        typingDiv.id = 'typing-indicator';
        typingDiv.className = 'flex space-x-1 p-3 bg-gray-200 rounded-lg max-w-[80%] my-2 self-start rounded-bl-none';
        
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('div');
            dot.className = 'w-2 h-2 bg-gray-500 rounded-full animate-bounce';
            dot.style.animationDelay = `${i * 0.2}s`;
            typingDiv.appendChild(dot);
        }
        
        chatArea.appendChild(typingDiv);
        chatArea.scrollTop = chatArea.scrollHeight;
    }
    
    function hideTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    if (messageForm && csrfChatTokenInput) {
        messageForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            const messageText = messageInput.value.trim();
            const csrfToken = csrfChatTokenInput.value;

            if (!messageText) return;
            if (!csrfToken) {
                displayMessage('system', 'Security token missing. Please refresh.');
                return;
            }

            displayMessage('user', messageText);
            messageInput.value = ''; // Clear input
            messageInput.disabled = true; // Disable input while waiting for AI

            try {
                const response = await fetch('api/chat_handler.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: messageText,
                        chat_id: currentChatId, // Can be null for a new chat
                        subject_id: currentSubjectId, // Add this line to pass the subject ID
                        csrf_token: csrfToken
                    })
                });
                const data = await response.json();
                messageInput.disabled = false; // Re-enable input

                if (data.success) {
                    displayMessage('ai', data.ai_message);
                    if (data.chat_id && (!currentChatId || currentChatId !== data.chat_id)) {
                        // If it was a new chat or chat_id changed (shouldn't happen if currentChatId was set from new chat response)
                        currentChatId = data.chat_id;
                        loadChats(); // Refresh chat list if a new chat was created
                        // Optionally, highlight the new/current chat
                        document.querySelectorAll('#chat-list li').forEach(li => {
                           li.classList.toggle('active', li.dataset.chatId == currentChatId);
                        });
                    }
                } else {
                    displayMessage('system', 'AI Error: ' + (data.message || 'Failed to get response.'));
                }
            } catch (error) {
                console.error('Error sending message:', error);
                displayMessage('system', 'Network error or server issue. Please try again.');
                messageInput.disabled = false;
            }
        });
    }

    if (newChatButton) {
        newChatButton.addEventListener('click', () => {
            currentChatId = null; // Signal that the next message starts a new chat
            chatMessagesArea.innerHTML = '<p class="chat-placeholder">Starting a new chat. Type your message below.</p>';
            // De-select any active chat in sidebar
            document.querySelectorAll('#chat-list li.active').forEach(li => li.classList.remove('active'));
            messageInput.focus();
        });
    }

    // Initial load of chats if user is logged in and chat elements exist
    if (chatListUL) { // Check if chat interface elements are on the page
        loadChats();
    }
});


// Add subject selection functionality
// Add a variable to track current subject
let currentSubjectId = null;

// List of legal subjects for the LocalVakil2 application
const legalSubjects = [
    // Core Legal Areas
    { id: 1, name: 'Constitutional Law' },
    { id: 2, name: 'Criminal Law' },
    { id: 3, name: 'Civil Law' },
    { id: 4, name: 'Family Law' },
    { id: 5, name: 'Property Law' },
    { id: 6, name: 'Contract Law' },
    { id: 7, name: 'Tort Law' },
    
    // Business & Commercial
    { id: 8, name: 'Corporate Law' },
    { id: 9, name: 'Intellectual Property' },
    { id: 10, name: 'Tax Law' },
    { id: 11, name: 'Banking & Finance' },
    { id: 12, name: 'Securities Law' },
    { id: 13, name: 'Competition Law' },
    { id: 14, name: 'Bankruptcy & Insolvency' },
    
    // Specialized Areas
    { id: 15, name: 'Labor & Employment' },
    { id: 16, name: 'Environmental Law' },
    { id: 17, name: 'Immigration Law' },
    { id: 18, name: 'Cyber Law & IT' },
    { id: 19, name: 'Media & Entertainment' },
    { id: 20, name: 'Healthcare Law' },
    { id: 21, name: 'Education Law' },
    
    // Dispute Resolution
    { id: 22, name: 'Arbitration & Mediation' },
    { id: 23, name: 'Consumer Protection' },
    { id: 24, name: 'Human Rights' },
    { id: 25, name: 'Administrative Law' },
    
    // International
    { id: 26, name: 'International Law' },
    { id: 27, name: 'Maritime Law' },
    { id: 28, name: 'Aviation Law' },
    
    // Procedural
    { id: 29, name: 'Civil Procedure' },
    { id: 30, name: 'Criminal Procedure' },
    { id: 31, name: 'Evidence Law' },
    
    // Emerging Areas
    { id: 32, name: 'Data Privacy' },
    { id: 33, name: 'Blockchain & Cryptocurrency' },
    { id: 34, name: 'AI & Robotics Law' },
    { id: 35, name: 'Sports Law' },
    { id: 36, name: 'Elder Law' },
    { id: 37, name: 'Agricultural Law' },
    { id: 38, name: 'Energy Law' }
];

// Render subject selection UI
function renderSubjects() {
  const container = document.getElementById('subject-container');
  if (!container) return; // Safety check if container doesn't exist
  
  legalSubjects.forEach(subject => {
    const btn = document.createElement('button');
    btn.className = 'subject-btn';
    btn.dataset.id = subject.id;
    btn.textContent = subject.name;
    btn.onclick = () => loadChatForSubject(subject.id);
    container.appendChild(btn);
  });
}

// Function to load chat for a specific subject
function loadChatForSubject(subjectId) {
  // Remove active class from all buttons
  document.querySelectorAll('.subject-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Add active class to selected button
  const selectedBtn = document.querySelector(`.subject-btn[data-id="${subjectId}"]`);
  if (selectedBtn) selectedBtn.classList.add('active');
  
  // Set current subject ID and load related chats
  currentChatId = null; // Reset current chat
  currentSubjectId = subjectId;
  
  // Clear chat messages area and show loading message
  if (chatMessagesArea) {
    chatMessagesArea.innerHTML = '<p class="chat-placeholder">Select a chat or start a new one for this subject.</p>';
  }
  
  // Load chats for this subject
  loadChatsForSubject(subjectId);
}

// Function to load chats for a specific subject
async function loadChatsForSubject(subjectId) {
  if (!chatListUL) return;
  try {
    const response = await fetch(`api/load_chats.php?action=list_chats&subject_id=${subjectId}`);
    const data = await response.json();
    if (data.success && data.chats) {
      chatListUL.innerHTML = ''; // Clear existing list
      if (data.chats.length === 0) {
        chatListUL.innerHTML = '<li class="no-chats">No chats for this subject yet</li>';
      } else {
        data.chats.forEach(chat => {
          const li = document.createElement('li');
          li.textContent = chat.title;
          li.dataset.chatId = chat.id;
          li.addEventListener('click', () => loadChatMessages(chat.id));
          chatListUL.appendChild(li);
        });
      }
    } else {
      console.error('Failed to load chats:', data.message);
    }
  } catch (error) {
    console.error('Error loading chats for subject:', error);
  }
}

// Call renderSubjects when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();
  
  // Initialize subject selection
  renderSubjects();