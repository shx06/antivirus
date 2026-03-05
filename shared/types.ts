/**
 * Shared types used by both the Electron main process and the React renderer.
 * Keep this file free of Node.js / browser-only APIs.
 */

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------

export type ScanMode = 'quick' | 'full' | 'custom';

export type ScanStatus =
  | 'idle'
  | 'running'
  | 'completed'
  | 'cancelled'
  | 'error';

export interface ScanOptions {
  mode: ScanMode;
  /** Used only when mode === 'custom' */
  customPaths?: string[];
}

export interface InfectedFile {
  path: string;
  signature: string;
  discoveredAt: string; // ISO 8601
}

export interface ScanProgress {
  scannedFiles: number;
  scannedDirectories: number;
  currentFile: string;
}

export interface ScanResult {
  id: string;
  mode: ScanMode;
  status: ScanStatus;
  startedAt: string;
  finishedAt?: string;
  scannedFiles: number;
  scannedDirectories: number;
  infectedFiles: InfectedFile[];
  errorMessage?: string;
}

// ---------------------------------------------------------------------------
// Quarantine
// ---------------------------------------------------------------------------

export interface QuarantineEntry {
  id: string;
  originalPath: string;
  quarantinedAt: string;
  signature: string;
  /** Relative path inside the quarantine directory */
  quarantineRelPath: string;
}

// ---------------------------------------------------------------------------
// IPC channel names (type-safe constants)
// ---------------------------------------------------------------------------

export const IPC = {
  // Renderer → Main
  START_SCAN: 'scan:start',
  CANCEL_SCAN: 'scan:cancel',
  SELECT_FOLDER: 'dialog:selectFolder',
  SELECT_FILE: 'dialog:selectFile',
  QUARANTINE_FILE: 'quarantine:file',
  RESTORE_FILE: 'quarantine:restore',
  DELETE_QUARANTINE: 'quarantine:delete',
  GET_QUARANTINE_LIST: 'quarantine:list',
  GET_HISTORY: 'history:get',
  CLEAR_HISTORY: 'history:clear',
  CHECK_CLAMAV: 'clamav:check',
  GET_SETTINGS: 'settings:get',
  SAVE_SETTINGS: 'settings:save',

  // Main → Renderer
  SCAN_PROGRESS: 'scan:progress',
  SCAN_RESULT: 'scan:result',
  SCAN_ERROR: 'scan:error',
} as const;

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface AppSettings {
  clamscanPath: string;
  quarantineDir: string;
  maxHistoryEntries: number;
  theme: 'light' | 'dark' | 'system';
}

export const DEFAULT_SETTINGS: AppSettings = {
  clamscanPath: '',
  quarantineDir: '',
  maxHistoryEntries: 50,
  theme: 'system',
};

// ---------------------------------------------------------------------------
// ClamAV health check
// ---------------------------------------------------------------------------

export interface ClamAVStatus {
  found: boolean;
  path: string;
  version?: string;
  error?: string;
}
