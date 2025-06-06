const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');

// Enable hot reloading during development
if (process.argv.includes('--enable-hot-reload')) {
  require('electron-reload')(__dirname, {
    electron: path.join(__dirname, 'node_modules', '.bin', 'electron'), // Path to Electron binary
    hardResetMethod: 'exit', // Ensure full reload
    ignored: /node_modules|[/\\]\./ // Ignore node_modules and hidden files
  });
}

function createWindow() {
  // Create a browser window
  let win = new BrowserWindow({
    width: 600,
    height: 400,
    frame: false, // Remove window frame (no titlebar)
    transparent: true, // Make window transparent
    alwaysOnTop: true, // Keep window on top of others
    skipTaskbar: true, // Hide from taskbar
    webPreferences: {
      nodeIntegration: true, // Enable Node.js in renderer
      contextIsolation: false, // Required for nodeIntegration
    },
  });

  // Load the HTML file
  win.loadFile('src/index.html');

  // Hide window from screen capture (works on some platforms)
  win.setContentProtection(true);

  // Make window movable by dragging
  win.setMovable(true);

  // Prevent window from being resized
  win.setResizable(false);

  // Optional: Add global shortcut to toggle window visibility
  globalShortcut.register('CommandOrControl+Shift+H', () => {
    if (win.isVisible()) {
      win.hide();
    } else {
      win.show();
      win.focus(); // Ensure window can accept input when shown
    }
  });

  // Ensure input field can be focused when clicked
  win.on('blur', () => {
    // Optionally minimize focus loss impact; adjust as needed
  });

  // Handle window close gracefully
  win.on('closed', () => {
    win = null;
  });
}

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