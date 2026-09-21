import { app, BrowserWindow, shell, Menu } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { TabManager } from './tab-manager';
import { registerIpcHandlers } from './ipc-handlers';
import { EvidenceCollector } from '../automation/evidence';
import { LocalControlServer } from './local-server';
import { AppSettings } from '../shared/types';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import { setupAppUpdates } from './app-updates';

const mainModuleDir = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
let tabManager: TabManager | null = null;
let localServer: LocalControlServer | null = null;
let appUpdates: ReturnType<typeof setupAppUpdates>;
let isQuitting = false;

// Keep installed versions on one profile even when the product name changes.
// Development continues using its existing Electron profile.
if (app.isPackaged) app.setPath('userData', path.join(app.getPath('appData'), 'browser-nova'));
const hasInstanceLock = app.requestSingleInstanceLock();
if (!hasInstanceLock) app.quit();

const defaultSettings: AppSettings = {
  aiProvider: 'gemini',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  maxActionsPerRun: 20,
  maxRunDurationSec: 180,
  requireConfirmForSensitive: true,
};

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

function loadSettings(): AppSettings {
  try {
    const p = getSettingsPath();
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
      return { ...defaultSettings, ...data };
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  return { ...defaultSettings };
}

function saveSettings(settings: AppSettings) {
  try {
    fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

// Chrome-style keyboard shortcuts. An application menu is used (instead of a
// renderer keydown listener) so the accelerators fire even while a web page
// inside a WebContentsView holds keyboard focus.
function buildAppMenu(win: BrowserWindow, tm: TabManager) {
  const isMac = process.platform === 'darwin';
  const activeId = () => tm.getActiveTab()?.info.id ?? null;

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [{
          label: 'Browser Nova',
          submenu: [
            { role: 'about' as const },
            { label: 'Check for Updates…', click: () => { void appUpdates.showUpdates(); } },
            { type: 'separator' as const },
            { role: 'services' as const },
            { type: 'separator' as const },
            { role: 'hide' as const }, { role: 'hideOthers' as const }, { role: 'unhide' as const },
            { type: 'separator' as const }, { role: 'quit' as const },
          ],
        }]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Tab',
          accelerator: 'CmdOrCtrl+T',
          click: () => tm.createTab('about:blank'),
        },
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            const id = activeId();
            if (id) tm.closeTab(id);
          },
        },
        isMac ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            const id = activeId();
            if (id) tm.reload(id);
          },
        },
        {
          label: 'Focus Address Bar',
          accelerator: 'CmdOrCtrl+L',
          click: () => win.webContents.send(IPC_CHANNELS.SHELL_FOCUS_OMNIBOX),
        },
        { type: 'separator' as const },
        {
          label: 'Developer Tools',
          accelerator: isMac ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
          click: () => {
            const id = activeId();
            if (id) tm.openDevTools(id);
          },
        },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const },
      ],
    },
    {
      label: 'History',
      submenu: [
        {
          label: 'Back',
          accelerator: isMac ? 'Cmd+Left' : 'Alt+Left',
          click: () => {
            const id = activeId();
            if (id) tm.goBack(id);
          },
        },
        {
          label: 'Forward',
          accelerator: isMac ? 'Cmd+Right' : 'Alt+Right',
          click: () => {
            const id = activeId();
            if (id) tm.goForward(id);
          },
        },
      ],
    },
    { role: 'windowMenu' },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createWindow() {
  const currentSettings = loadSettings();
  const artifactsDir = path.join(app.getPath('userData'), 'artifacts');

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    title: 'Browser Nova',
    titleBarStyle: 'hiddenInset', // sleek macOS native titlebar styling
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: path.resolve(mainModuleDir, '../preload/index.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  const evidence = new EvidenceCollector(artifactsDir);
  tabManager = new TabManager(mainWindow, artifactsDir, currentSettings);

  // Harden the app shell: the shell renderer hosts trusted app UI only. It must
  // never navigate away from the app or spawn OS windows. Web browsing happens
  // inside the WebContentsView tabs, which have their own handlers.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Route external http(s) links to the user's default browser; deny the rest.
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url).catch(() => {});
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const devServerUrl = process.env.VITE_DEV_SERVER_URL;
    const isShellUrl =
      url.startsWith('file://') || (devServerUrl && url.startsWith(devServerUrl));
    if (!isShellUrl) {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) {
        shell.openExternal(url).catch(() => {});
      }
    }
  });

  registerIpcHandlers(tabManager, evidence, loadSettings, saveSettings);

  // Chrome-style keyboard shortcuts (New/Close tab, reload, focus omnibox, nav).
  buildAppMenu(mainWindow, tabManager);

  // Start local CLI control server
  localServer = new LocalControlServer(tabManager, evidence, app.getPath('userData'));
  await localServer.start();

  // Load UI
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
  } else {
    await mainWindow.loadFile(path.resolve(mainModuleDir, '../renderer/index.html'));
  }

  // Handle window resizing to update view bounds
  mainWindow.on('resize', () => {
    // Renderer sends updated bounds on resize, but ensure layout stays clean
  });

  // Create initial tab
  setTimeout(() => {
    tabManager?.createTab(app.isPackaged ? 'about:blank' : 'http://127.0.0.1:8080');
  }, 500);

  // Retain the macOS window on close so Dock activation reuses its tabs and IPC.
  mainWindow.on('close', (event) => {
    if (process.platform === 'darwin' && !isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    localServer?.stop();
  });
}

// App lifecycle
if (hasInstanceLock) {
  app.whenReady().then(async () => {
    app.setAboutPanelOptions({ applicationName: 'Browser Nova', applicationVersion: app.getVersion() });
    appUpdates = setupAppUpdates(() => mainWindow);
    await createWindow();
  }).catch((error) => {
    console.error('Unable to start Browser Nova:', error);
    app.quit();
  });
}

app.on('before-quit', () => {
  isQuitting = true;
  localServer?.stop();
});

const showMainWindow = () => {
  if (mainWindow?.isMinimized()) mainWindow.restore();
  mainWindow?.show();
  mainWindow?.focus();
};
app.on('second-instance', showMainWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  showMainWindow();
});
