const { ipcRenderer } = require('electron');

// DOM elements
const chatArea = document.getElementById('chat-area');
const chatInput = document.getElementById('chat-input');
const chatContainer = document.getElementById('chat-container');
const sendButton = document.getElementById('send-button');

// Function to add a message to the chat
function addMessage(text, sender) {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message', sender === 'user' ? 'user-message' : 'ai-message');

  // Basic markdown-like formatting for newlines
  const formattedText = text.replace(/\n/g, '<br>');
  messageDiv.innerHTML = formattedText;

  chatArea.appendChild(messageDiv);

  // Smooth scroll to bottom
  chatContainer.scrollTo({
    top: chatArea.scrollHeight,
    behavior: 'smooth'
  });
}

// Initialize chat history
let chatHistory = [
  { role: 'user', parts: [{ text: 'Hello, I need help with some questions.' }] },
  { role: 'model', parts: [{ text: 'Welcome to Latent Chat! How can I assist you?' }] }
];

// Display initial welcome message
addMessage('Welcome to Latent Chat! How can I assist you?', 'ai');

async function handleSendMessage() {
  const userMessage = chatInput.value.trim();
  if (!userMessage) return;

  const originalPlaceholder = chatInput.placeholder;
  addMessage(userMessage, 'user');
  chatInput.value = ''; // Clear input
  chatInput.disabled = true;
  chatInput.placeholder = 'Thinking...';

  try {
    // Send message to main process for Gemini API call
    const aiResponse = await ipcRenderer.invoke('send-to-gemini', userMessage, chatHistory);
    addMessage(aiResponse, 'ai');

    // Update chat history
    chatHistory.push(
      { role: 'user', parts: [{ text: userMessage }] },
      { role: 'model', parts: [{ text: aiResponse }] }
    );
  } catch (error) {
    addMessage(`Error: ${error.message} `, 'ai');
  } finally {
    chatInput.disabled = false;
    chatInput.placeholder = originalPlaceholder;
    chatInput.focus();
  }
}

// Handle input submission
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    handleSendMessage();
  }
});

sendButton.addEventListener('click', handleSendMessage);