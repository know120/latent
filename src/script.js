const { ipcRenderer } = require('electron');

// DOM elements
const chatArea = document.getElementById('chat-area');
const chatInput = document.getElementById('chat-input');
const chatContainer = document.getElementById('chat-container');
const sendButton = document.getElementById('send-button');

// API Modal elements
const apiModal = document.getElementById('api-modal');
const apiKeyInput = document.getElementById('api-key-input');
const toggleVisibilityBtn = document.getElementById('toggle-api-visibility');
const eyeIcon = toggleVisibilityBtn.querySelector('.eye-icon');
const eyeOffIcon = toggleVisibilityBtn.querySelector('.eye-off-icon');
const saveApiKeyButton = document.getElementById('save-api-key-button');

// Model Selector elements
const modelSelect = document.getElementById('model-select');

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

// API Key & Model Logic
async function initApp() {
  const config = await ipcRenderer.invoke('get-config');

  if (config.SELECTED_MODEL) {
    modelSelect.value = config.SELECTED_MODEL;
  }

  if (!config.GOOGLE_API_KEY) {
    apiModal.style.display = 'flex';
  } else {
    apiModal.style.display = 'none';
    chatInput.focus();
  }
}

modelSelect.addEventListener('change', async () => {
  const modelName = modelSelect.value;
  try {
    const result = await ipcRenderer.invoke('save-model', modelName);
    if (!result.success) {
      alert(`Error switching model: ${result.error}`);
    }
  } catch (error) {
    alert(`Error: ${error.message}`);
  }
});

toggleVisibilityBtn.addEventListener('click', () => {
  const isPassword = apiKeyInput.type === 'password';
  apiKeyInput.type = isPassword ? 'text' : 'password';
  eyeIcon.style.display = isPassword ? 'none' : 'block';
  eyeOffIcon.style.display = isPassword ? 'block' : 'none';
});

saveApiKeyButton.addEventListener('click', async () => {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) return;

  saveApiKeyButton.disabled = true;
  saveApiKeyButton.textContent = 'Saving...';

  try {
    const result = await ipcRenderer.invoke('save-api-key', apiKey);
    if (result.success) {
      apiModal.style.display = 'none';
      addMessage('API Key saved successfully! You can now start chatting.', 'ai');
      chatInput.focus();
    } else {
      alert(`Error saving API key: ${result.error}`);
    }
  } catch (error) {
    alert(`Error: ${error.message}`);
  } finally {
    saveApiKeyButton.disabled = false;
    saveApiKeyButton.textContent = 'Save Key';
  }
});

apiKeyInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    saveApiKeyButton.click();
  }
});

// Initialize on load
initApp();