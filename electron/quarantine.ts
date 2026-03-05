import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import log from 'electron-log';
import type { QuarantineEntry, InfectedFile } from '../shared/types';
import { generateId } from './utils';

const METADATA_FILE = 'quarantine-index.json';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadIndex(quarantineDir: string): QuarantineEntry[] {
  const indexPath = path.join(quarantineDir, METADATA_FILE);
  if (!fs.existsSync(indexPath)) return [];
  try {
    const raw = fs.readFileSync(indexPath, 'utf8');
    return JSON.parse(raw) as QuarantineEntry[];
  } catch (err) {
    log.warn('[quarantine] Could not read index file:', err);
    return [];
  }
}

function saveIndex(quarantineDir: string, entries: QuarantineEntry[]): void {
  const indexPath = path.join(quarantineDir, METADATA_FILE);
  fs.writeFileSync(indexPath, JSON.stringify(entries, null, 2), 'utf8');
}

function ensureQuarantineDir(quarantineDir: string): void {
  if (!fs.existsSync(quarantineDir)) {
    fs.mkdirSync(quarantineDir, { recursive: true });
    log.info(`[quarantine] Created quarantine directory: ${quarantineDir}`);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Move an infected file into the quarantine directory.
 * The file is renamed with a randomised name to prevent accidental execution.
 */
export function quarantineFile(
  file: InfectedFile,
  quarantineDir: string
): QuarantineEntry {
  ensureQuarantineDir(quarantineDir);

  const safeId = generateId();
  const ext = path.extname(file.path);
  // Append .quar so the OS doesn't try to open/execute the file
  const quarantineRelPath = `${safeId}${ext}.quar`;
  const quarantineFullPath = path.join(quarantineDir, quarantineRelPath);

  // Copy-then-delete to avoid moving across file-system boundaries on some OS
  fs.copyFileSync(file.path, quarantineFullPath);
  fs.unlinkSync(file.path);

  const entry: QuarantineEntry = {
    id: safeId,
    originalPath: file.path,
    quarantinedAt: new Date().toISOString(),
    signature: file.signature,
    quarantineRelPath,
  };

  const entries = loadIndex(quarantineDir);
  entries.push(entry);
  saveIndex(quarantineDir, entries);

  log.info(`[quarantine] Quarantined: ${file.path} → ${quarantineFullPath}`);
  return entry;
}

/**
 * Restore a file from quarantine back to its original path.
 */
export function restoreFile(
  entryId: string,
  quarantineDir: string
): { success: boolean; error?: string } {
  const entries = loadIndex(quarantineDir);
  const idx = entries.findIndex((e) => e.id === entryId);
  if (idx === -1) {
    return { success: false, error: `Entry ${entryId} not found in quarantine index.` };
  }

  const entry = entries[idx];
  const quarantineFullPath = path.join(quarantineDir, entry.quarantineRelPath);

  if (!fs.existsSync(quarantineFullPath)) {
    return { success: false, error: `Quarantined file missing on disk: ${quarantineFullPath}` };
  }

  const targetDir = path.dirname(entry.originalPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  fs.copyFileSync(quarantineFullPath, entry.originalPath);
  fs.unlinkSync(quarantineFullPath);

  entries.splice(idx, 1);
  saveIndex(quarantineDir, entries);

  log.info(`[quarantine] Restored: ${quarantineFullPath} → ${entry.originalPath}`);
  return { success: true };
}

/**
 * Permanently delete a quarantined file (no recovery possible).
 */
export function deleteFromQuarantine(
  entryId: string,
  quarantineDir: string
): { success: boolean; error?: string } {
  const entries = loadIndex(quarantineDir);
  const idx = entries.findIndex((e) => e.id === entryId);
  if (idx === -1) {
    return { success: false, error: `Entry ${entryId} not found in quarantine index.` };
  }

  const entry = entries[idx];
  const quarantineFullPath = path.join(quarantineDir, entry.quarantineRelPath);

  if (fs.existsSync(quarantineFullPath)) {
    // Overwrite with random bytes before deletion for added security
    const size = fs.statSync(quarantineFullPath).size;
    const handle = fs.openSync(quarantineFullPath, 'r+');
    const random = crypto.randomBytes(Math.min(size, 65536));
    fs.writeSync(handle, random, 0, random.length, 0);
    fs.closeSync(handle);
    fs.unlinkSync(quarantineFullPath);
  }

  entries.splice(idx, 1);
  saveIndex(quarantineDir, entries);

  log.info(`[quarantine] Permanently deleted: ${quarantineFullPath}`);
  return { success: true };
}

/**
 * Return the current quarantine list.
 */
export function listQuarantine(quarantineDir: string): QuarantineEntry[] {
  ensureQuarantineDir(quarantineDir);
  return loadIndex(quarantineDir);
}
