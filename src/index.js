const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Load environment variables
require('dotenv').config();
const API_KEY = process.env.GOOGLE_API_KEY;

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

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
    width: 600,
    height: 300,
    frame: false,
    // title: 'Latent Chat',
    resizable: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Load the HTML file
  win.loadFile('src/index.html');

  // Hide window from screen capture
  win.setContentProtection(true);

  // Make window movable
  win.setMovable(true);

  // Prevent window from being resized
  win.setResizable(false);

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
    const chat = model.startChat({ history: chatHistory });
    const result = await chat.sendMessage(userMessage);
    return result.response.text();
  } catch (error) {
    throw new Error(`Gemini API error: ${error.message}`);
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