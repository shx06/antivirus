import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/types';
import type {
  ScanOptions,
  ScanProgress,
  ScanResult,
  QuarantineEntry,
  InfectedFile,
  ClamAVStatus,
  AppSettings,
} from '../shared/types';

/**
 * Secure IPC bridge exposed to the renderer via contextBridge.
 * Only the specific channels listed here are accessible from the renderer.
 * The renderer CANNOT access Node.js or Electron APIs directly.
 */
const api = {
  // Scanning
  startScan: (options: ScanOptions): Promise<ScanResult> =>
    ipcRenderer.invoke(IPC.START_SCAN, options),

  cancelScan: (): void =>
    ipcRenderer.send(IPC.CANCEL_SCAN),

  onScanProgress: (cb: (progress: ScanProgress) => void) => {
    const listener = (_: Electron.IpcRendererEvent, progress: ScanProgress) =>
      cb(progress);
    ipcRenderer.on(IPC.SCAN_PROGRESS, listener);
    return () => ipcRenderer.removeListener(IPC.SCAN_PROGRESS, listener);
  },

  onScanResult: (cb: (result: ScanResult) => void) => {
    const listener = (_: Electron.IpcRendererEvent, result: ScanResult) =>
      cb(result);
    ipcRenderer.on(IPC.SCAN_RESULT, listener);
    return () => ipcRenderer.removeListener(IPC.SCAN_RESULT, listener);
  },

  onScanError: (cb: (message: string) => void) => {
    const listener = (_: Electron.IpcRendererEvent, message: string) =>
      cb(message);
    ipcRenderer.on(IPC.SCAN_ERROR, listener);
    return () => ipcRenderer.removeListener(IPC.SCAN_ERROR, listener);
  },

  // Dialogs
  selectFolder: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC.SELECT_FOLDER),

  selectFile: (filters?: Electron.FileFilter[]): Promise<string | null> =>
    ipcRenderer.invoke(IPC.SELECT_FILE, filters),

  // Quarantine
  quarantineFile: (file: InfectedFile): Promise<QuarantineEntry> =>
    ipcRenderer.invoke(IPC.QUARANTINE_FILE, file),

  restoreFile: (entryId: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC.RESTORE_FILE, entryId),

  deleteFromQuarantine: (entryId: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC.DELETE_QUARANTINE, entryId),

  getQuarantineList: (): Promise<QuarantineEntry[]> =>
    ipcRenderer.invoke(IPC.GET_QUARANTINE_LIST),

  // History
  getHistory: (): Promise<ScanResult[]> =>
    ipcRenderer.invoke(IPC.GET_HISTORY),

  clearHistory: (): Promise<void> =>
    ipcRenderer.invoke(IPC.CLEAR_HISTORY),

  // ClamAV health
  checkClamAV: (): Promise<ClamAVStatus> =>
    ipcRenderer.invoke(IPC.CHECK_CLAMAV),

  // Settings
  getSettings: (): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC.GET_SETTINGS),

  saveSettings: (settings: AppSettings): Promise<void> =>
    ipcRenderer.invoke(IPC.SAVE_SETTINGS, settings),
};

contextBridge.exposeInMainWorld('electronAPI', api);

export type ElectronAPI = typeof api;
