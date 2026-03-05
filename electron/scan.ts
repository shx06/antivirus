import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
import log from 'electron-log';
import type {
  ScanOptions,
  ScanResult,
  ScanProgress,
  InfectedFile,
  ClamAVStatus,
} from '../shared/types';
import { generateId } from './utils';

const execAsync = promisify(exec);

// ---------------------------------------------------------------------------
// ClamAV path resolution
// ---------------------------------------------------------------------------

const WINDOWS_DEFAULT_PATHS = [
  'C:\\Program Files\\ClamAV\\clamscan.exe',
  'C:\\Program Files (x86)\\ClamAV\\clamscan.exe',
  path.join(os.homedir(), 'scoop', 'apps', 'clamav', 'current', 'clamscan.exe'),
  path.join(os.homedir(), 'scoop', 'shims', 'clamscan.exe'),
];

const MACOS_DEFAULT_PATHS = [
  '/opt/homebrew/bin/clamscan',
  '/usr/local/bin/clamscan',
  '/usr/bin/clamscan',
];

const LINUX_DEFAULT_PATHS = [
  '/usr/bin/clamscan',
  '/usr/local/bin/clamscan',
  '/opt/clamav/bin/clamscan',
];

export function getDefaultClamscanPaths(): string[] {
  switch (process.platform) {
    case 'win32':
      return WINDOWS_DEFAULT_PATHS;
    case 'darwin':
      return MACOS_DEFAULT_PATHS;
    default:
      return LINUX_DEFAULT_PATHS;
  }
}

export async function checkClamAV(
  overridePath?: string
): Promise<ClamAVStatus> {
  const candidates = overridePath
    ? [overridePath]
    : ['clamscan', ...getDefaultClamscanPaths()];

  for (const candidate of candidates) {
    try {
      const { stdout } = await execAsync(`"${candidate}" --version`, {
        timeout: 5000,
      });
      const version = stdout.trim().split('\n')[0];
      log.info(`[ClamAV] Found at: ${candidate} — ${version}`);
      return { found: true, path: candidate, version };
    } catch {
      // not found at this location, try next
    }
  }

  return {
    found: false,
    path: '',
    error:
      'clamscan not found. Please install ClamAV and ensure it is available in PATH or configure its path in Settings.',
  };
}

// ---------------------------------------------------------------------------
// Scan target resolution
// ---------------------------------------------------------------------------

export function getQuickScanPaths(): string[] {
  const home = os.homedir();
  const tmp = os.tmpdir();

  if (process.platform === 'win32') {
    return [
      path.join(home, 'Desktop'),
      path.join(home, 'Downloads'),
      path.join(home, 'Documents'),
      tmp,
      path.join(os.homedir(), 'AppData', 'Local', 'Temp'),
    ].filter((p) => p);
  }

  if (process.platform === 'darwin') {
    return [
      path.join(home, 'Desktop'),
      path.join(home, 'Downloads'),
      path.join(home, 'Documents'),
      tmp,
      '/private/tmp',
    ];
  }

  return [
    path.join(home, 'Desktop'),
    path.join(home, 'Downloads'),
    path.join(home, 'Documents'),
    tmp,
  ];
}

export function getFullScanPaths(): string[] {
  if (process.platform === 'win32') {
    return ['C:\\'];
  }
  if (process.platform === 'darwin') {
    return ['/'];
  }
  return ['/'];
}

// ---------------------------------------------------------------------------
// Parser helpers
// ---------------------------------------------------------------------------

function parseClamscanOutput(output: string): {
  infected: InfectedFile[];
  scannedFiles: number;
  scannedDirs: number;
} {
  const infected: InfectedFile[] = [];
  let scannedFiles = 0;
  let scannedDirs = 0;

  for (const line of output.split('\n')) {
    const infectedMatch = line.match(/^(.+): (.+) FOUND$/);
    if (infectedMatch) {
      infected.push({
        path: infectedMatch[1].trim(),
        signature: infectedMatch[2].trim(),
        discoveredAt: new Date().toISOString(),
      });
      continue;
    }

    const filesMatch = line.match(/Scanned files:\s*(\d+)/i);
    if (filesMatch) {
      scannedFiles = parseInt(filesMatch[1], 10);
      continue;
    }

    const dirsMatch = line.match(/Scanned directories:\s*(\d+)/i);
    if (dirsMatch) {
      scannedDirs = parseInt(dirsMatch[1], 10);
    }
  }

  return { infected, scannedFiles, scannedDirs };
}

// ---------------------------------------------------------------------------
// Scan runner
// ---------------------------------------------------------------------------

type ProgressCallback = (progress: ScanProgress) => void;

export async function runScan(
  options: ScanOptions,
  clamscanPath: string,
  onProgress: ProgressCallback,
  signal: AbortSignal
): Promise<ScanResult> {
  const id = generateId();
  const startedAt = new Date().toISOString();

  let scanPaths: string[];
  switch (options.mode) {
    case 'quick':
      scanPaths = getQuickScanPaths();
      break;
    case 'full':
      scanPaths = getFullScanPaths();
      break;
    case 'custom':
      scanPaths = options.customPaths ?? [];
      break;
  }

  if (scanPaths.length === 0) {
    return {
      id,
      mode: options.mode,
      status: 'error',
      startedAt,
      finishedAt: new Date().toISOString(),
      scannedFiles: 0,
      scannedDirectories: 0,
      infectedFiles: [],
      errorMessage: 'No scan targets specified.',
    };
  }

  const args = [
    '--recursive',
    '--infected',
    '--no-summary=no',
    '--stdout',
    ...scanPaths,
  ];

  log.info(`[scan] Starting ${options.mode} scan: ${clamscanPath} ${args.join(' ')}`);

  return new Promise<ScanResult>((resolve) => {
    let stdoutBuffer = '';
    let stderrBuffer = '';
    let scannedFiles = 0;
    let scannedDirs = 0;
    let cancelled = false;

    const proc = spawn(clamscanPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    signal.addEventListener('abort', () => {
      cancelled = true;
      proc.kill('SIGTERM');
      log.info('[scan] Cancelled by user.');
    });

    proc.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stdoutBuffer += text;

      for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Progress: track files/dirs
        const filesMatch = trimmed.match(/Scanned files:\s*(\d+)/i);
        if (filesMatch) scannedFiles = parseInt(filesMatch[1], 10);

        const dirsMatch = trimmed.match(/Scanned directories:\s*(\d+)/i);
        if (dirsMatch) scannedDirs = parseInt(dirsMatch[1], 10);

        onProgress({
          scannedFiles,
          scannedDirectories: scannedDirs,
          currentFile: trimmed,
        });
      }
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      stderrBuffer += chunk.toString();
    });

    proc.on('close', (code) => {
      const finishedAt = new Date().toISOString();
      const parsed = parseClamscanOutput(stdoutBuffer);

      log.info(
        `[scan] Finished (exit ${code}): ${parsed.scannedFiles} files, ${parsed.infected.length} infected`
      );

      if (cancelled) {
        resolve({
          id,
          mode: options.mode,
          status: 'cancelled',
          startedAt,
          finishedAt,
          scannedFiles: parsed.scannedFiles,
          scannedDirectories: parsed.scannedDirs,
          infectedFiles: parsed.infected,
        });
        return;
      }

      // clamscan exit codes: 0 = clean, 1 = infected found, 2 = error
      if (code === 2) {
        resolve({
          id,
          mode: options.mode,
          status: 'error',
          startedAt,
          finishedAt,
          scannedFiles: parsed.scannedFiles,
          scannedDirectories: parsed.scannedDirs,
          infectedFiles: parsed.infected,
          errorMessage: stderrBuffer || 'clamscan returned an error.',
        });
        return;
      }

      resolve({
        id,
        mode: options.mode,
        status: 'completed',
        startedAt,
        finishedAt,
        scannedFiles: parsed.scannedFiles,
        scannedDirectories: parsed.scannedDirs,
        infectedFiles: parsed.infected,
      });
    });

    proc.on('error', (err) => {
      log.error('[scan] Process error:', err);
      resolve({
        id,
        mode: options.mode,
        status: 'error',
        startedAt,
        finishedAt: new Date().toISOString(),
        scannedFiles: 0,
        scannedDirectories: 0,
        infectedFiles: [],
        errorMessage: err.message,
      });
    });
  });
}
