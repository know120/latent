const { ipcRenderer } = require('electron');

// DOM elements
const chatArea = document.getElementById('chat-area');
const chatInput = document.getElementById('chat-input');
const chatContainer = document.getElementById('chat-container');

// Function to add a message to the chat
function addMessage(text, sender) {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message', sender === 'user' ? 'user-message' : 'ai-message');
  messageDiv.innerText = text;
  chatArea.appendChild(messageDiv);
  chatContainer.scrollTop = chatArea.scrollHeight; // Scroll to bottom
}

// Initialize chat history
let chatHistory = [
  { role: 'user', parts: [{ text: 'Hello, I need help with some questions.' }] },
  { role: 'model', parts: [{ text: 'Welcome to Latent Chat! How can I assist you?' }] }
];

// Display initial welcome message
addMessage('Welcome to Latent Chat! How can I assist you?', 'ai');

// Handle input submission
chatInput.addEventListener('keypress', async (e) => {
  if (e.key === 'Enter' && chatInput.value.trim()) {
    const originalPlaceHolder = chatInput.placeHolder;
    const userMessage = chatInput.value.trim();
    addMessage(userMessage, 'user');
    chatInput.value = ''; // Clear input
    chatInput.disabled = true;
    chatInput.placeHolder = 'Thinking...';
    
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
    } finally{
      chatInput.disabled = false;
      chatInput.placeHolder = originalPlaceHolder;
    }

  }
});