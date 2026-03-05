# 🛡️ AntivirusApp

A cross-platform desktop antivirus / malware scanner built with **Electron + React + TypeScript**, powered by **ClamAV**.

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Screenshots](#screenshots)
4. [Prerequisites](#prerequisites)
5. [ClamAV Installation](#clamav-installation)
   - [Windows](#clamav-windows)
   - [macOS](#clamav-macos)
6. [Setup & Development](#setup--development)
7. [Packaging / Distribution](#packaging--distribution)
   - [Windows](#packaging-windows)
   - [macOS](#packaging-macos)
   - [GitHub Actions](#github-actions-packaging)
8. [Project Structure](#project-structure)
9. [Architecture & IPC](#architecture--ipc)
10. [Scan Modes](#scan-modes)
11. [Quarantine](#quarantine)
12. [Settings & Configuration](#settings--configuration)
13. [Scan History](#scan-history)
14. [Known Limitations](#known-limitations)
15. [ClamAV FAQ](#clamav-faq)
16. [License](#license)

---

## Overview

AntivirusApp is a **sandboxed Electron application** that integrates with the user-installed ClamAV to scan files and directories for malware.  
The scanning logic runs inside the **Electron main process** and communicates with the **React renderer** through a secure IPC bridge, ensuring the UI never freezes during long scans.

---

## Features

| Feature | Description |
|---------|-------------|
| ⚡ **Quick Scan** | Scans user hotspots: Downloads, Desktop, Documents, temp folders |
| 🔎 **Full Scan** | Scans the entire file system (with exclusions as needed) |
| 📁 **Custom Scan** | User selects any file or folder via native dialog |
| 🔒 **Quarantine** | Move suspicious files to an isolated directory; restore or permanently delete |
| 📋 **Scan History** | Persistent log of past scans with results |
| ⚙️ **Settings** | Configure ClamAV path, quarantine dir, history limit, theme |
| 🌙 **Dark / Light / System Theme** | Full theming support |
| 🔐 **Secure IPC** | `contextBridge` + `contextIsolation: true`, no `nodeIntegration` |
| 🛡️ **Cross-Platform** | Windows (primary), macOS |

---

## Screenshots

> Run the app with `npm run dev` to see the UI live.

---

## Prerequisites

- **Node.js** ≥ 18 (LTS recommended)  
- **npm** ≥ 9  
- **ClamAV** installed separately (see below)

---

## ClamAV Installation

AntivirusApp does **not** bundle ClamAV. You must install it separately and update the virus database (`freshclam`) before scanning.

### ClamAV — Windows {#clamav-windows}

1. Download the Windows installer from **[https://www.clamav.net/downloads](https://www.clamav.net/downloads)**.
2. Run the installer. Default path: `C:\Program Files\ClamAV\`
3. After install, copy the sample config files and remove the `Example` line:
   ```bat
   cd "C:\Program Files\ClamAV"
   copy freshclam.conf.sample freshclam.conf
   :: Open freshclam.conf and remove/comment the "Example" line
   copy clamd.conf.sample clamd.conf
   ```
4. Download the latest virus definitions:
   ```bat
   "C:\Program Files\ClamAV\freshclam.exe"
   ```
5. In **AntivirusApp → Settings**, set the clamscan path to:
   ```
   C:\Program Files\ClamAV\clamscan.exe
   ```
   Or leave blank if `clamscan` is on your `PATH`.

6. Click **Test** to verify.

> **Scoop users:** `scoop install clamav` — clamscan will be found automatically.

---

### ClamAV — macOS {#clamav-macos}

**Homebrew (recommended):**

```bash
brew install clamav
```

After install, configure freshclam:

```bash
cp $(brew --prefix)/etc/clamav/freshclam.conf.sample \
   $(brew --prefix)/etc/clamav/freshclam.conf

# Remove the "Example" line (required):
sed -i '' '/^Example/d' $(brew --prefix)/etc/clamav/freshclam.conf

# Download virus definitions:
freshclam
```

The app auto-detects `/opt/homebrew/bin/clamscan` (Apple Silicon) and `/usr/local/bin/clamscan` (Intel). Leave the path blank in Settings.

---

## Setup & Development

```bash
# 1. Clone the repository
git clone https://github.com/shx06/antivirus.git
cd antivirus

# 2. Install dependencies
npm install

# 3. Copy example environment file
cp .env.example .env
# Edit .env if you need to override the clamscan path

# 4. Start in development mode (Vite + Electron with DevTools)
npm run dev
```

The renderer runs at `http://localhost:5173`. Electron loads it directly during development.

### TypeScript type-checking

```bash
npm run typecheck
```

### Linting

```bash
npm run lint
```

---

## Packaging / Distribution

### Packaging — Windows {#packaging-windows}

```bash
npm run package:win
```

Output is in `release/`. Produces an NSIS installer (`.exe`).

**Requirements:**  
- Run on Windows, or use a Windows CI runner.  
- Code-signing is optional but recommended for distribution.

### Packaging — macOS {#packaging-macos}

```bash
npm run package:mac
```

Produces a `.dmg` in `release/`.

**Requirements:**  
- macOS machine or a macOS GitHub Actions runner (`macos-latest`).  
- For notarization, set `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` environment variables.

### GitHub Actions Packaging {#github-actions-packaging}

Example workflow (`.github/workflows/release.yml`):

```yaml
name: Build & Package

on:
  push:
    tags: ['v*']

jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run package:win
      - uses: actions/upload-artifact@v4
        with:
          name: windows-installer
          path: release/*.exe

  build-mac:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run package:mac
      - uses: actions/upload-artifact@v4
        with:
          name: mac-dmg
          path: release/*.dmg
```

---

## Project Structure

```
antivirus/
├── electron/               # Electron main process
│   ├── main.ts             # App entry, IPC handlers, BrowserWindow
│   ├── preload.ts          # Secure contextBridge IPC bridge
│   ├── scan.ts             # ClamAV process spawning & output parsing
│   ├── quarantine.ts       # Quarantine: move/restore/delete files
│   └── utils.ts            # Shared utilities (generateId)
├── src/                    # React renderer (TypeScript)
│   ├── index.tsx           # React entry point
│   ├── App.tsx             # Root component, page routing, theme
│   ├── electron.d.ts       # Window.electronAPI type declaration
│   ├── components/
│   │   ├── Sidebar.tsx     # Navigation sidebar
│   │   ├── Dashboard.tsx   # Overview: ClamAV status, quick actions
│   │   ├── ScanPage.tsx    # Scan controls, progress, results
│   │   ├── ResultsTable.tsx # Infected files table
│   │   ├── QuarantinePage.tsx # Quarantine management
│   │   ├── HistoryPage.tsx # Past scan history
│   │   └── SettingsPage.tsx # Settings & ClamAV install guide
│   └── styles/
│       ├── global.css      # CSS reset, variables, utilities
│       └── app.css         # Layout, cards, buttons, tables
├── shared/
│   └── types.ts            # Shared TypeScript types & IPC constants
├── public/                 # Static assets (icons)
├── index.html              # Vite HTML entry
├── package.json
├── tsconfig.json           # Renderer TypeScript config
├── tsconfig.electron.json  # Main process TypeScript config
├── vite.config.ts          # Vite bundler config
├── .env.example            # Example environment variables
└── README.md
```

---

## Architecture & IPC

```
┌─────────────────────────────────────────────────────────┐
│  Renderer (React, sandboxed)                            │
│  window.electronAPI.startScan()  ──► IPC invoke ──►     │
│  window.electronAPI.onScanProgress() ◄── IPC send ◄──   │
└─────────────────────────────────────────────────────────┘
                        │ contextBridge (preload.ts)
┌─────────────────────────────────────────────────────────┐
│  Main Process (Node.js / Electron)                      │
│  ipcMain.handle(START_SCAN) → runScan() → spawn clamscan│
│  ipcMain.handle(QUARANTINE_FILE) → quarantineFile()     │
│  electron-store → settings, history persistence         │
└─────────────────────────────────────────────────────────┘
                        │ child_process.spawn
┌─────────────────────────────────────────────────────────┐
│  ClamAV (external, user-installed)                      │
│  clamscan --recursive --infected <paths>                │
└─────────────────────────────────────────────────────────┘
```

**Security model:**
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- Only whitelisted IPC channels are exposed via `contextBridge`
- The renderer has no direct access to Node.js or the file system

---

## Scan Modes

| Mode | Targets |
|------|---------|
| **Quick** | `~/Desktop`, `~/Downloads`, `~/Documents`, system temp |
| **Full** | `C:\` (Windows), `/` (macOS/Linux) |
| **Custom** | Any path selected via native folder dialog |

Quick Scan is recommended for regular checks. Full Scan can take hours on large disks.

---

## Quarantine

When you click **Quarantine** on an infected file:

1. The file is **copied** to `<userData>/quarantine/` (or the configured path)
2. The original file is **deleted**
3. A `.quar` extension is appended to prevent accidental execution
4. Metadata (original path, signature, timestamp) is saved in `quarantine-index.json`

**Restore:** Copies the file back to its original path and removes it from quarantine.

**Delete:** Overwrites the quarantined file with random bytes before deletion for added security, then removes the metadata.

---

## Settings & Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `clamscanPath` | Full path to `clamscan` binary | Auto-detect |
| `quarantineDir` | Directory for quarantined files | `<userData>/quarantine` |
| `maxHistoryEntries` | Max stored scan results | 50 |
| `theme` | UI theme: `light`, `dark`, `system` | `system` |

Settings are persisted via `electron-store` in the OS user-data directory:
- Windows: `%APPDATA%\antivirus-app\config.json`
- macOS: `~/Library/Application Support/antivirus-app/config.json`

You can also override settings via `.env` file (see `.env.example`).

---

## Scan History

Past scan results are stored in `electron-store` and shown in the **History** page.  
Each entry includes: mode, status, start/end time, number of files scanned, infected files list.

History is capped at `maxHistoryEntries` (default 50). You can clear it from the History page.

---

## Known Limitations

- **Real-time protection:** Not supported. This app performs on-demand scans only.
- **System tray:** Not included.
- **Kernel drivers:** Not used or required.
- **ClamAV must be separately installed:** The app does not bundle ClamAV.
- **Virus definitions:** Must be manually updated with `freshclam`. The app does not auto-update.
- **Full Scan performance:** Scanning the entire file system may take a long time. The UI remains responsive via async IPC.
- **Privileged paths:** Scanning system directories may require elevated permissions on some platforms.
- **macOS SIP:** System Integrity Protection may prevent scanning `/System` and other protected paths; this is expected.
- **Windows Defender conflicts:** Real-time protection in Windows Defender may slow down ClamAV scans on the same files.

---

## ClamAV FAQ

**Q: clamscan is not found even after installation.**  
A: Ensure the ClamAV directory is in your `PATH`, or set the full path in **Settings → ClamAV**.

**Q: "LibClamAV Warning: Can't find virus database"**  
A: Run `freshclam` to download virus definitions. On Windows, run as Administrator.

**Q: Scan exits with error code 2.**  
A: clamscan returned an error (often missing database or permissions). Check stderr output shown in the UI.

**Q: The quarantine folder is in an unexpected location.**  
A: Default is `<userData>/quarantine`. On Windows: `%APPDATA%\antivirus-app\quarantine`. Override in Settings.

**Q: macOS says "clamscan cannot be opened because it is from an unidentified developer".**  
A: Run: `xattr -d com.apple.quarantine $(which clamscan)` or allow it in System Settings → Privacy & Security.

**Q: How do I update virus definitions?**  
A: Run `freshclam` from a terminal. Schedule it via Task Scheduler (Windows) or cron (macOS/Linux).

**Q: Can I use ClamD (daemon) instead of clamscan?**  
A: Not in the current version. The app spawns `clamscan` directly. ClamD support is a potential future enhancement.

---

## License

MIT © shx06
