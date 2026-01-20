const { app, BrowserWindow, globalShortcut, ipcMain, Menu } = require('electron');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');

// Load environment variables based on app context
const envPath = path.join(__dirname, '..', '.env');
dotenv.config({ path: envPath });

const configPath = path.join(app.getPath('userData'), 'config.json');

function getConfig() {
  const config = {
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || null,
    SELECTED_MODEL: 'gemini-2.5-flash'
  };

  if (fs.existsSync(configPath)) {
    try {
      const storedConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (storedConfig.GOOGLE_API_KEY) config.GOOGLE_API_KEY = storedConfig.GOOGLE_API_KEY;
      if (storedConfig.SELECTED_MODEL) config.SELECTED_MODEL = storedConfig.SELECTED_MODEL;
    } catch (e) {
      console.error('Error reading config file:', e);
    }
  }
  return config;
}

let genAI;
let model;

function initializeGemini(apiKey, modelName = 'gemini-2.5-flash') {
  if (apiKey) {
    genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({ model: modelName });
  }
}

// Initial initialization if key exists
const config = getConfig();
initializeGemini(config.GOOGLE_API_KEY, config.SELECTED_MODEL);

// Enable hot reloading during development
if (process.argv.includes('--enable-hot-reload')) {
  require('electron-reload')(__dirname, {
    electron: path.join(__dirname, 'node_modules', '.bin', 'electron'),
    hardResetMethod: 'exit',
    ignored: /node_modules|[\\]\./
  });
}

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

  // Load the HTML file
  win.loadFile('src/index.html');

  // Remove the default menu
  Menu.setApplicationMenu(null);

  // Hide window from screen capture
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

  // Handle window focus
  win.on('blur', () => {
    // Optionally minimize focus loss impact
  });

  // Handle window close
  win.on('closed', () => {
    win = null;
  });
}

// Handle Gemini API calls via IPC
ipcMain.handle('send-to-gemini', async (event, userMessage, chatHistory) => {
  try {
    if (!model) {
      throw new Error('API Key not configured. Please set your API key.');
    }
    const chat = model.startChat({ history: chatHistory });
    const result = await chat.sendMessage(userMessage);
    return result.response.text();
  } catch (error) {
    throw new Error(`Gemini API error: ${error.message}`);
  }
});

ipcMain.handle('check-api-key', () => {
  return !!getConfig().GOOGLE_API_KEY;
});

ipcMain.handle('get-config', () => {
  return getConfig();
});

ipcMain.handle('save-api-key', (event, apiKey) => {
  try {
    const config = getConfig();
    config.GOOGLE_API_KEY = apiKey;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    initializeGemini(apiKey, config.SELECTED_MODEL);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-model', (event, modelName) => {
  try {
    const config = getConfig();
    config.SELECTED_MODEL = modelName;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    if (config.GOOGLE_API_KEY) {
      initializeGemini(config.GOOGLE_API_KEY, modelName);
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Create window when app is ready
app.whenReady().then(createWindow);

// Quit app when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Recreate window on macOS when dock icon is clicked
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Clean up shortcuts on app quit
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});