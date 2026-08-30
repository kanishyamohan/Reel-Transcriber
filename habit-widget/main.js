'use strict';

const { app, BrowserWindow, ipcMain, screen, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const MIN_WIDTH = 300;
const MIN_HEIGHT = 380;
const DEFAULT_WIDTH = 430;
const DEFAULT_HEIGHT = 560;

let win = null;

/* ------------------------------------------------------------------ *
 * Persistence: a single JSON file in the app's userData directory.
 * ~/Library/Application Support/Reel Habit/habit-data.json on macOS.
 * ------------------------------------------------------------------ */

function dataFile() {
  return path.join(app.getPath('userData'), 'habit-data.json');
}

function readData() {
  try {
    return JSON.parse(fs.readFileSync(dataFile(), 'utf8'));
  } catch (err) {
    return null;
  }
}

function writeData(data) {
  const file = dataFile();
  const tmp = `${file}.tmp`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Write to a temp file first so a crash mid-write can never truncate
  // the real data file.
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

/* ------------------------------------------------------------------ *
 * Window
 * ------------------------------------------------------------------ */

function savedBounds() {
  const data = readData();
  const b = data && data.window;
  if (!b || typeof b.width !== 'number' || typeof b.height !== 'number') return null;

  // Only reuse the position if it still lands on a connected display —
  // otherwise the widget reopens off-screen after unplugging a monitor.
  const onScreen = screen.getAllDisplays().some((d) => {
    const wa = d.workArea;
    return b.x < wa.x + wa.width && b.x + b.width > wa.x &&
           b.y < wa.y + wa.height && b.y + b.height > wa.y;
  });
  return onScreen ? b : null;
}

function persistBounds() {
  if (!win || win.isDestroyed()) return;
  const data = readData() || {};
  data.window = win.getBounds();
  writeData(data);
}

function createWindow() {
  const bounds = savedBounds();

  win = new BrowserWindow({
    width: bounds ? bounds.width : DEFAULT_WIDTH,
    height: bounds ? bounds.height : DEFAULT_HEIGHT,
    x: bounds ? bounds.x : undefined,
    y: bounds ? bounds.y : undefined,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Live on every Space so the widget is there whichever desktop you're on.
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });

  const stored = readData();
  applyPinned(stored && stored.pinned === true);

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());

  let boundsTimer = null;
  const scheduleBoundsSave = () => {
    clearTimeout(boundsTimer);
    boundsTimer = setTimeout(persistBounds, 400);
  };
  win.on('move', scheduleBoundsSave);
  win.on('resize', scheduleBoundsSave);
  win.on('close', persistBounds);
  win.on('closed', () => { win = null; });

  // Any link in the widget opens in the real browser, never in the widget.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function applyPinned(pinned) {
  if (!win || win.isDestroyed()) return;
  if (pinned) {
    // 'floating' keeps it above ordinary windows without covering menus.
    win.setAlwaysOnTop(true, 'floating');
  } else {
    win.setAlwaysOnTop(false);
  }
}

/* ------------------------------------------------------------------ *
 * IPC
 * ------------------------------------------------------------------ */

ipcMain.handle('store:load', () => readData());

ipcMain.handle('store:save', (_event, payload) => {
  const data = readData() || {};
  // The renderer owns everything except window bounds, which main tracks.
  writeData({ ...data, ...payload, window: data.window });
  return true;
});

ipcMain.handle('win:setPinned', (_event, pinned) => {
  applyPinned(pinned === true);
  return pinned === true;
});

ipcMain.handle('win:resizeBy', (_event, dx, dy) => {
  if (!win || win.isDestroyed()) return null;
  const b = win.getBounds();
  win.setBounds({
    x: b.x,
    y: b.y,
    width: Math.max(MIN_WIDTH, Math.round(b.width + dx)),
    height: Math.max(MIN_HEIGHT, Math.round(b.height + dy))
  });
  return win.getBounds();
});

ipcMain.handle('app:getLoginItem', () => app.getLoginItemSettings().openAtLogin === true);

ipcMain.handle('app:setLoginItem', (_event, enabled) => {
  app.setLoginItemSettings({ openAtLogin: enabled === true, openAsHidden: false });
  return app.getLoginItemSettings().openAtLogin === true;
});

ipcMain.handle('win:hide', () => {
  if (win && !win.isDestroyed()) win.hide();
});

ipcMain.handle('app:quit', () => app.quit());

/* ------------------------------------------------------------------ *
 * Lifecycle
 * ------------------------------------------------------------------ */

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win && !win.isDestroyed()) {
      win.show();
      win.focus();
    }
  });

  app.whenReady().then(createWindow);

  app.on('activate', () => {
    if (!win || win.isDestroyed()) createWindow();
    else win.show();
  });

  // The widget is meant to stay running; closing the last window on macOS
  // should not quit it.
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
