/**
 * @fileoverview Main process for the Squitty application.
 * Manages the application lifecycle, tray icon, window creation,
 * and global mouse event hooking via uiohook-napi.
 */

const { app, BrowserWindow, Tray, Menu, ipcMain, dialog, screen } = require('electron');
const path = require('path');
const { uIOhook, EventType } = require('uiohook-napi');
const { DEFAULT_SETTINGS } = require('./constants');
const { calculatePan, loadSettings, saveSettingsSync } = require('./utils');

/** @type {Electron.CrossProcessExports.Tray} */
let tray = null;
/** @type {Electron.CrossProcessExports.BrowserWindow} */
let audioWindow = null;
/** @type {Electron.CrossProcessExports.BrowserWindow} */
let settingsWindow = null;
/** @type {Electron.CrossProcessExports.BrowserWindow} */
let creditsWindow = null;

/** @type {Set<number>} Tracks currently pressed mouse buttons */
let activeButtons = new Set();
/** @type {number|null} Timer for the hold sound activation delay */
let holdTimeout = null;

/** @type {number} Last known mouse X coordinate */
let lastX = 0;
/** @type {number} Last known mouse Y coordinate */
let lastY = 0;
/** @type {number} Timestamp of the last processed move event */
let lastMoveTime = 0;
/** @type {number} Timestamp of the last processed scroll event */
let lastScrollTime = 0;

/** @type {Object} DEFAULT_SETTINGS settings */
let settings = DEFAULT_SETTINGS;

/** @type {number|null} Timer for debounced settings saving */
let saveTimeout = null;

/**
 * Persists settings to disk with a debounce of 1 second.
 */
function saveSettings() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveSettingsSync(settings);
    saveTimeout = null;
  }, 1000);
}

/** @type {boolean} Indicates if the audio renderer window is fully loaded */
let audioReady = false;

/**
 * Creates the hidden background window responsible for audio synthesis.
 */
function createAudioWindow() {
  audioWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false
    }
  });
  audioWindow.loadFile('audio.html');
  audioWindow.webContents.on('did-finish-load', () => {
    audioReady = true;
  });
}

/**
 * Creates or focuses the Settings window.
 */
function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 450,
    height: 900,
    minWidth: 400,
    minHeight: 400,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    resizable: true,
    title: 'Squitty Settings',
    skipTaskbar: true
  });
  settingsWindow.loadFile('settings.html');
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

/**
 * Creates or focuses the "About Squitty" (Credits) window.
 */
function createCreditsWindow() {
  if (creditsWindow) {
    creditsWindow.focus();
    return;
  }
  creditsWindow = new BrowserWindow({
    width: 420,
    height: 600,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    title: 'About Squitty',
    skipTaskbar: true
  });
  creditsWindow.loadFile('credits.html');
  creditsWindow.on('closed', () => {
    creditsWindow = null;
  });
}

/**
 * Initializes the system tray icon and context menu.
 */
function setupTray() {
  const { nativeImage } = require('electron');
  const iconPath = path.join(__dirname, 'iconTemplate.png');
  let icon = nativeImage.createFromPath(iconPath);

  if (icon.isEmpty()) {
    console.warn('Tray icon file not found or corrupted, using fallback icon.');
    // 22x22 black square
    icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAABMSURBVHgB7dKxEQAgCAVRYXpnbYaxG2shK/AnI86XUu4oHkO6C7A9278zX2Y9/PMeX2Y9/PMeX2Y9/PMeX2Y9/PMeX2Y9/PMeX2Y9/PMe/0uX6y0j98XN1AAAAABJRU5ErkJggg==');
  } else {
    icon.setTemplateImage(true);
  }

  try {
    tray = new Tray(icon);
  } catch (err) {
    console.error('Failed to create tray:', err);
    return;
  }
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Settings', click: () => createSettingsWindow() },
    { label: 'About Squitty', click: () => createCreditsWindow() },
    { type: 'separator' },
    { label: 'Quit', click: () => {
      uIOhook.stop();
      app.quit();
    } }
  ]);
  tray.setToolTip('Squitty - Mechanical Mouse Sounds');
  tray.setContextMenu(contextMenu);
}

// Application startup
app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock.hide();

  settings = loadSettings();
  createAudioWindow();
  setupTray();

  // Listen for mouse down events
  uIOhook.on('mousedown', (e) => {
    activeButtons.add(e.button);
    if (activeButtons.size === 1 && audioReady && settings.pressHold.enabled) {
      const pan = calculatePan(e.x);
      const delay = settings.pressHold.delay !== undefined ? settings.pressHold.delay : 250;
      if (holdTimeout) clearTimeout(holdTimeout);
      holdTimeout = setTimeout(() => {
        audioWindow.webContents.send('start-hold-sound', { ...settings.pressHold, pan });
        holdTimeout = null;
      }, delay);
    }
    if (audioReady && settings.mousedown.enabled) {
      const pan = calculatePan(e.x);
      audioWindow.webContents.send('play-sound', 'mousedown', { ...settings.mousedown, pan });
    }
  });

  // Listen for mouse up events
  uIOhook.on('mouseup', (e) => {
    activeButtons.delete(e.button);
    if (activeButtons.size === 0) {
      if (holdTimeout) {
        clearTimeout(holdTimeout);
        holdTimeout = null;
      }
      if (audioReady) {
        audioWindow.webContents.send('stop-hold-sound');
      }
    }
    if (audioReady && settings.mouseup.enabled) {
      const pan = calculatePan(e.x);
      audioWindow.webContents.send('play-sound', 'mouseup', { ...settings.mouseup, pan });
    }
  });

  // Listen for mouse wheel events
  uIOhook.on('wheel', (e) => {
    const now = Date.now();
    let velocity = 1.0;
    if (lastScrollTime > 0) {
      const dt = now - lastScrollTime;
      // Normalize velocity based on scroll frequency
      velocity = Math.min(5.0, 100 / Math.max(10, dt));
    }
    lastScrollTime = now;

    if (audioReady && settings.scroll.enabled) {
      const pan = calculatePan(e.x);
      audioWindow.webContents.send('play-sound', 'scroll', { ...settings.scroll, pan, velocity });
    }
  });

  /**
   * Handles mouse move and drag events with velocity calculation and self-healing logic.
   * @param {Object} e - The uiohook event object.
   */
  const handleMove = (e) => {
    const now = Date.now();
    let velocity = 1.0;

    if (lastMoveTime > 0) {
      const dt = now - lastMoveTime;
      const dx = e.x - lastX;
      const dy = e.y - lastY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      // Normalized velocity based on distance over time
      velocity = distance / (Math.max(1, dt) * 0.33);
    }

    const dtForThrottle = now - lastMoveTime;

    // Self-healing: Reset button state if we move without dragging
    if (e.type === EventType.EVENT_MOUSE_MOVED && activeButtons.size > 0) {
        activeButtons.clear();
        if (holdTimeout) {
            clearTimeout(holdTimeout);
            holdTimeout = null;
        }
        if (audioReady) {
            audioWindow.webContents.send('stop-hold-sound');
        }
    }

    // Throttle movement sounds to avoid overwhelming the audio engine
    if (audioReady && settings.move.enabled && dtForThrottle > 30) {
      const pan = calculatePan(e.x);
      audioWindow.webContents.send('play-sound', 'move', { ...settings.move, pan, velocity });
      lastMoveTime = now;
      lastX = e.x;
      lastY = e.y;
    } else if (lastMoveTime === 0) {
      lastMoveTime = now;
      lastX = e.x;
      lastY = e.y;
    }
  };

  uIOhook.on('mousemove', handleMove);
  uIOhook.on('mousedrag', handleMove);

  // Catch-all for input events to handle missing mousedrag events in some environments
  uIOhook.on('input', (e) => {
    if (e.type === 10) { // Native mousedrag type
      uIOhook.emit('mousedrag', e);
    }
  });

  uIOhook.start();
}).catch(err => {
  console.error('Failed to start Squitty:', err);
});

// Prevent application from quitting when windows are closed
app.on('window-all-closed', (e) => {
  if (process.platform !== 'darwin') {
    // Keep running in tray
  }
});

// Final save on application quit
app.on('will-quit', () => {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveSettingsSync(settings);
  }
});

/**
 * IPC handler: Returns current settings.
 */
ipcMain.on('get-settings', (event) => {
  event.returnValue = settings;
});

/**
 * IPC listener: Opens the credits window.
 */
ipcMain.on('open-credits', () => {
  createCreditsWindow();
});

/**
 * IPC listener: Updates current settings and triggers immediate audio engine adjustments.
 */
ipcMain.on('update-settings', (event, newSettings) => {
  const wasMoveEnabled = settings.move.enabled;
  const wasHoldEnabled = settings.pressHold.enabled;
  settings = newSettings;
  saveSettings();
  if (wasMoveEnabled && !settings.move.enabled) {
    if (audioWindow) audioWindow.webContents.send('stop-move-sound');
  }
  if (wasHoldEnabled && !settings.pressHold.enabled) {
    if (holdTimeout) {
      clearTimeout(holdTimeout);
      holdTimeout = null;
    }
    if (audioWindow) audioWindow.webContents.send('stop-hold-sound');
  }
});

/**
 * IPC handler: Opens a file dialog to select a custom audio file.
 */
ipcMain.handle('select-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Audio', extensions: ['wav', 'mp3', 'ogg', 'm4a'] }]
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});
