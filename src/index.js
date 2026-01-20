const { app, BrowserWindow, globalShortcut, ipcMain, Menu } = require('electron');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const dotenv = require('dotenv');

// Load environment variables
const envPath = path.join(__dirname, '..', '.env');
dotenv.config({ path: envPath });

const configPath = path.join(app.getPath('userData'), 'config.json');

const DEFAULT_CONFIG = {
  activeProvider: 'google',
  providers: {
    google: {
      apiKey: process.env.GOOGLE_API_KEY || '',
      selectedModel: 'gemini-2.5-flash'
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      selectedModel: 'gpt-4o'
    }
  }
};

function getConfig() {
  let config = { ...DEFAULT_CONFIG };

  if (fs.existsSync(configPath)) {
    try {
      const stored = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

      // Migration and merging
      if (stored.GOOGLE_API_KEY) {
        config.providers.google.apiKey = stored.GOOGLE_API_KEY;
      }
      if (stored.SELECTED_MODEL && stored.activeProvider === 'google') {
        config.providers.google.selectedModel = stored.SELECTED_MODEL;
      }

      // Deep merge for providers
      if (stored.activeProvider) config.activeProvider = stored.activeProvider;
      if (stored.providers) {
        for (const p in stored.providers) {
          config.providers[p] = { ...config.providers[p], ...stored.providers[p] };
        }
      }
    } catch (e) {
      console.error('Error reading config file:', e);
    }
  }
  return config;
}

function saveConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

let aiClient = null;
let aiModel = null;

function initializeAI(provider, apiKey, modelName) {
  if (!apiKey) {
    aiClient = null;
    aiModel = null;
    return;
  }

  try {
    if (provider === 'google') {
      const genAI = new GoogleGenerativeAI(apiKey);
      aiClient = genAI;
      aiModel = genAI.getGenerativeModel({ model: modelName });
    } else if (provider === 'openai') {
      const openai = new OpenAI({ apiKey });
      aiClient = openai;
      aiModel = modelName;
    }
  } catch (error) {
    console.error(`Failed to initialize ${provider}:`, error);
  }
}

// Initial initialization
const initialConfig = getConfig();
initializeAI(
  initialConfig.activeProvider,
  initialConfig.providers[initialConfig.activeProvider].apiKey,
  initialConfig.providers[initialConfig.activeProvider].selectedModel
);

function createWindow() {
  // Create a browser window with 50% larger dimensions
  let win = new BrowserWindow({
    width: 800,
    height: 600,
    icon: path.join(__dirname, 'logo.svg'),
    // frame: false,
    title: 'Latent',
    resizable: true,
    // transparent: true,
    alwaysOnTop: false,
    skipTaskbar: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.loadFile('src/index.html');
  Menu.setApplicationMenu(null);
  win.setContentProtection(true);

  // Make window movable
  // win.setMovable(true);

  // Prevent window from being resized
  // win.setResizable(false);

  // Prevert title bar on focus
  // win.setFocusable(false);

  // Toggle window visibility with shortcut
  globalShortcut.register('CommandOrControl+Shift+H', () => {
    if (win.isVisible()) {
      win.hide();
    } else {
      win.show();
      win.focus();
    }
  });

  win.on('closed', () => {
    win = null;
  });
}

// IPC Handlers
ipcMain.handle('send-to-ai', async (event, userMessage, chatHistory) => {
  const config = getConfig();
  const provider = config.activeProvider;
  const providerConfig = config.providers[provider];

  if (!aiModel || !providerConfig.apiKey) {
    throw new Error('AI not configured. Please set your API key in settings.');
  }

  try {
    if (provider === 'google') {
      const chat = aiModel.startChat({ history: chatHistory });
      const result = await chat.sendMessage(userMessage);
      return result.response.text();
    } else if (provider === 'openai') {
      // Convert Gemini style history to OpenAI style
      const messages = chatHistory.map(h => ({
        role: h.role === 'user' ? 'user' : 'assistant',
        content: h.parts[0].text
      }));
      messages.push({ role: 'user', content: userMessage });

      const response = await aiClient.chat.completions.create({
        model: providerConfig.selectedModel,
        messages: messages,
      });
      return response.choices[0].message.content;
    }
  } catch (error) {
    throw new Error(`${provider} API error: ${error.message}`);
  }
});

// Legacy handler for compatibility during transition
ipcMain.handle('send-to-gemini', async (event, msg, history) => {
  return await ipcMain.emit('send-to-ai', event, msg, history);
});

ipcMain.handle('get-config', () => getConfig());

ipcMain.handle('save-config', (event, newConfig) => {
  saveConfig(newConfig);
  const provider = newConfig.activeProvider;
  const pConfig = newConfig.providers[provider];
  initializeAI(provider, pConfig.apiKey, pConfig.selectedModel);
  return { success: true };
});

ipcMain.handle('check-api-key', () => {
  const config = getConfig();
  return !!config.providers[config.activeProvider].apiKey;
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});