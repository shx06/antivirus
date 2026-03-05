import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
} from 'electron';
import * as path from 'path';
import Store from 'electron-store';
import log from 'electron-log';
import { IPC, DEFAULT_SETTINGS } from '../shared/types';
import type { AppSettings, ScanOptions, ScanResult, InfectedFile } from '../shared/types';
import { runScan, checkClamAV } from './scan';
import {
  quarantineFile,
  restoreFile,
  deleteFromQuarantine,
  listQuarantine,
} from './quarantine';

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface StoreSchema {
  settings: AppSettings;
  history: ScanResult[];
}

const store = new Store<StoreSchema>({
  defaults: {
    settings: DEFAULT_SETTINGS,
    history: [],
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getQuarantineDir(): string {
  const saved = store.get('settings.quarantineDir', '');
  return saved || path.join(app.getPath('userData'), 'quarantine');
}

function getClamscanPath(): string {
  return store.get('settings.clamscanPath', '');
}

function addToHistory(result: ScanResult): void {
  const maxEntries = store.get('settings.maxHistoryEntries', 50);
  const history = store.get('history', []);
  history.unshift(result);
  if (history.length > maxEntries) history.length = maxEntries;
  store.set('history', history);
}

// ---------------------------------------------------------------------------
// Active scan controller
// ---------------------------------------------------------------------------

let activeScanAbort: AbortController | null = null;

// ---------------------------------------------------------------------------
// Window creation
// ---------------------------------------------------------------------------

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    title: 'Antivirus App',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open external links in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(() => {
  log.info('[main] App ready, creating window...');
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---------------------------------------------------------------------------
// IPC handlers
// ---------------------------------------------------------------------------

// Start scan
ipcMain.handle(IPC.START_SCAN, async (event, options: ScanOptions) => {
  if (activeScanAbort) {
    activeScanAbort.abort();
    activeScanAbort = null;
  }

  activeScanAbort = new AbortController();
  const { signal } = activeScanAbort;

  // Resolve clamscan path
  let clamscanPath = getClamscanPath();
  if (!clamscanPath) {
    const status = await checkClamAV();
    if (!status.found) {
      const result: ScanResult = {
        id: Date.now().toString(),
        mode: options.mode,
        status: 'error',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        scannedFiles: 0,
        scannedDirectories: 0,
        infectedFiles: [],
        errorMessage: status.error,
      };
      return result;
    }
    clamscanPath = status.path;
  }

  const result = await runScan(
    options,
    clamscanPath,
    (progress) => {
      event.sender.send(IPC.SCAN_PROGRESS, progress);
    },
    signal
  );

  activeScanAbort = null;
  addToHistory(result);
  event.sender.send(IPC.SCAN_RESULT, result);
  return result;
});

// Cancel scan
ipcMain.on(IPC.CANCEL_SCAN, () => {
  if (activeScanAbort) {
    activeScanAbort.abort();
    activeScanAbort = null;
    log.info('[main] Scan cancelled.');
  }
});

// Folder dialog
ipcMain.handle(IPC.SELECT_FOLDER, async () => {
  if (!mainWindow) return null;
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select folder to scan',
  });
  return canceled ? null : filePaths[0];
});

// File dialog (for selecting executable paths)
ipcMain.handle(IPC.SELECT_FILE, async (_event, filters?: Electron.FileFilter[]) => {
  if (!mainWindow) return null;
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    title: 'Select file',
    filters: filters ?? [{ name: 'All Files', extensions: ['*'] }],
  });
  return canceled ? null : filePaths[0];
});

// Quarantine: move file
ipcMain.handle(IPC.QUARANTINE_FILE, (_event, file: InfectedFile) => {
  return quarantineFile(file, getQuarantineDir());
});

// Quarantine: restore
ipcMain.handle(IPC.RESTORE_FILE, (_event, entryId: string) => {
  return restoreFile(entryId, getQuarantineDir());
});

// Quarantine: delete permanently
ipcMain.handle(IPC.DELETE_QUARANTINE, (_event, entryId: string) => {
  return deleteFromQuarantine(entryId, getQuarantineDir());
});

// Quarantine: list
ipcMain.handle(IPC.GET_QUARANTINE_LIST, () => {
  return listQuarantine(getQuarantineDir());
});

// History
ipcMain.handle(IPC.GET_HISTORY, () => {
  return store.get('history', []);
});

ipcMain.handle(IPC.CLEAR_HISTORY, () => {
  store.set('history', []);
});

// ClamAV check
ipcMain.handle(IPC.CHECK_CLAMAV, async () => {
  const path = getClamscanPath();
  return checkClamAV(path || undefined);
});

// Settings
ipcMain.handle(IPC.GET_SETTINGS, () => {
  return store.get('settings', DEFAULT_SETTINGS);
});

ipcMain.handle(IPC.SAVE_SETTINGS, (_event, settings: AppSettings) => {
  store.set('settings', settings);
  log.info('[main] Settings saved.');
});
