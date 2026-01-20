const { ipcRenderer } = require('electron');

// DOM elements
const chatArea = document.getElementById('chat-area');
const chatInput = document.getElementById('chat-input');
const chatContainer = document.getElementById('chat-container');
const sendButton = document.getElementById('send-button');

// Selectors
const providerSelect = document.getElementById('provider-select');
const modelSelect = document.getElementById('model-select');

// API Modal elements
const apiModal = document.getElementById('api-modal');
const setupProvider = document.getElementById('setup-provider');
const apiKeyLabel = document.getElementById('api-key-label');
const apiKeyInput = document.getElementById('api-key-input');
const toggleVisibilityBtn = document.getElementById('toggle-api-visibility');
const eyeIcon = toggleVisibilityBtn.querySelector('.eye-icon');
const eyeOffIcon = toggleVisibilityBtn.querySelector('.eye-off-icon');
const saveApiKeyButton = document.getElementById('save-api-key-button');
const setupHelpText = document.getElementById('setup-help-text');

// Provider Metadata
const PROVIDERS = {
  google: {
    name: 'Google Gemini',
    help: 'You can find your Gemini API key in the <a href="https://aistudio.google.com/app/apikey" target="_blank">Google AI Studio</a>.',
    label: 'Google API Key',
    models: [
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
      { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' }
    ]
  },
  openai: {
    name: 'OpenAI',
    help: 'You can find your OpenAI API key in your <a href="https://platform.openai.com/api-keys" target="_blank">OpenAI Dashboard</a>.',
    label: 'OpenAI API Key',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o mini' },
      { id: 'o1-preview', name: 'o1 Preview' },
      { id: 'o1-mini', name: 'o1 mini' }
    ]
  }
};

let currentConfig = null;

// Function to add a message to the chat
function addMessage(text, sender) {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message', sender === 'user' ? 'user-message' : 'ai-message');

  const formattedText = text.replace(/\n/g, '<br>');
  messageDiv.innerHTML = formattedText;

  chatArea.appendChild(messageDiv);

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

addMessage('Welcome to Latent Chat! How can I assist you?', 'ai');

async function handleSendMessage() {
  const userMessage = chatInput.value.trim();
  if (!userMessage) return;

  const originalPlaceholder = chatInput.placeholder;
  addMessage(userMessage, 'user');
  chatInput.value = '';
  chatInput.disabled = true;
  chatInput.placeholder = 'Thinking...';

  try {
    const aiResponse = await ipcRenderer.invoke('send-to-ai', userMessage, chatHistory);
    addMessage(aiResponse, 'ai');

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

function populateModels(providerId, selectedModel) {
  const models = PROVIDERS[providerId].models;
  modelSelect.innerHTML = '';
  models.forEach(m => {
    const option = document.createElement('option');
    option.value = m.id;
    option.textContent = m.name;
    if (m.id === selectedModel) option.selected = true;
    modelSelect.appendChild(option);
  });
}

async function initApp() {
  currentConfig = await ipcRenderer.invoke('get-config');

  providerSelect.value = currentConfig.activeProvider;
  const activePConfig = currentConfig.providers[currentConfig.activeProvider];
  populateModels(currentConfig.activeProvider, activePConfig.selectedModel);

  if (!activePConfig.apiKey) {
    showSetupModal(currentConfig.activeProvider);
  } else {
    apiModal.style.display = 'none';
    chatInput.focus();
  }
}

function showSetupModal(providerId) {
  const provider = PROVIDERS[providerId];
  setupProvider.value = providerId;
  apiKeyLabel.textContent = provider.label;
  setupHelpText.innerHTML = provider.help;
  apiKeyInput.value = currentConfig.providers[providerId].apiKey;
  apiModal.style.display = 'flex';
}

providerSelect.addEventListener('change', async () => {
  const providerId = providerSelect.value;
  currentConfig.activeProvider = providerId;

  const pConfig = currentConfig.providers[providerId];
  populateModels(providerId, pConfig.selectedModel);

  if (!pConfig.apiKey) {
    showSetupModal(providerId);
  } else {
    await ipcRenderer.invoke('save-config', currentConfig);
  }
});

modelSelect.addEventListener('change', async () => {
  const modelId = modelSelect.value;
  currentConfig.providers[currentConfig.activeProvider].selectedModel = modelId;
  await ipcRenderer.invoke('save-config', currentConfig);
});

setupProvider.addEventListener('change', () => {
  const providerId = setupProvider.value;
  const provider = PROVIDERS[providerId];
  apiKeyLabel.textContent = provider.label;
  setupHelpText.innerHTML = provider.help;
  apiKeyInput.value = currentConfig.providers[providerId].apiKey;
});

saveApiKeyButton.addEventListener('click', async () => {
  const apiKey = apiKeyInput.value.trim();
  const providerId = setupProvider.value;

  if (!apiKey) {
    alert('Please enter an API key.');
    return;
  }

  saveApiKeyButton.disabled = true;
  saveApiKeyButton.textContent = 'Saving...';

  try {
    currentConfig.activeProvider = providerId;
    currentConfig.providers[providerId].apiKey = apiKey;

    const result = await ipcRenderer.invoke('save-config', currentConfig);
    if (result.success) {
      apiModal.style.display = 'none';
      providerSelect.value = providerId;
      populateModels(providerId, currentConfig.providers[providerId].selectedModel);
      addMessage(`Configuration for ${PROVIDERS[providerId].name} saved!`, 'ai');
      chatInput.focus();
    } else {
      alert(`Error saving configuration: ${result.error}`);
    }
  } catch (error) {
    alert(`Error: ${error.message}`);
  } finally {
    saveApiKeyButton.disabled = false;
    saveApiKeyButton.textContent = 'Save Configuration';
  }
});

toggleVisibilityBtn.addEventListener('click', () => {
  const isPassword = apiKeyInput.type === 'password';
  apiKeyInput.type = isPassword ? 'text' : 'password';
  eyeIcon.style.display = isPassword ? 'none' : 'block';
  eyeOffIcon.style.display = isPassword ? 'block' : 'none';
});

chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleSendMessage();
});

sendButton.addEventListener('click', handleSendMessage);

apiKeyInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') saveApiKeyButton.click();
});

initApp();