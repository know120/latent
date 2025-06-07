const { ipcRenderer } = require('electron');

// DOM elements
const chatContainer = document.getElementById('chat-container');
const chatInput = document.getElementById('chat-input');

// Function to add a message to the chat
function addMessage(text, sender) {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message', sender === 'user' ? 'user-message' : 'ai-message');
  messageDiv.innerText = text;
  chatContainer.appendChild(messageDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight; // Scroll to bottom
}

// Initialize chat history
let chatHistory = [
  { role: 'user', parts: [{ text: 'Hello, I need help with some questions.' }] },
  { role: 'model', parts: [{ text: 'AI: Welcome to the chat overlay! How can I assist you?' }] }
];

// Display initial welcome message
addMessage('AI: Welcome to the chat overlay! How can I assist you?', 'ai');

// Handle input submission
chatInput.addEventListener('keypress', async (e) => {
  if (e.key === 'Enter' && chatInput.value.trim()) {
    const userMessage = chatInput.value.trim();
    addMessage(userMessage, 'user');

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
      addMessage(`Error: ${error.message}`, 'ai');
    }

    chatInput.value = ''; // Clear input
  }
});