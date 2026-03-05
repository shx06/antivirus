import React, { useState, useCallback } from 'react';
import type { ScanMode, ScanOptions, ScanResult, ScanProgress, InfectedFile } from '../../shared/types';
import ResultsTable from './ResultsTable';
import './ScanPage.css';

const ScanPage: React.FC = () => {
  const [mode, setMode] = useState<ScanMode>('quick');
  const [customPath, setCustomPath] = useState<string>('');
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleBrowse = async () => {
    const folder = await window.electronAPI.selectFolder();
    if (folder) setCustomPath(folder);
  };

  const handleStartScan = useCallback(async () => {
    if (scanning) return;

    setScanning(true);
    setResult(null);
    setError(null);
    setProgress(null);

    const options: ScanOptions = {
      mode,
      customPaths: mode === 'custom' ? [customPath].filter(Boolean) : undefined,
    };

    // Subscribe to progress events
    const unsubProgress = window.electronAPI.onScanProgress((p) => {
      setProgress(p);
    });
    const unsubResult = window.electronAPI.onScanResult((r) => {
      setResult(r);
      setScanning(false);
      setProgress(null);
    });
    const unsubError = window.electronAPI.onScanError((msg) => {
      setError(msg);
      setScanning(false);
      setProgress(null);
    });

    try {
      const scanResult = await window.electronAPI.startScan(options);
      setResult(scanResult);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error during scan.');
    } finally {
      setScanning(false);
      setProgress(null);
      unsubProgress();
      unsubResult();
      unsubError();
    }
  }, [scanning, mode, customPath]);

  const handleCancel = () => {
    window.electronAPI.cancelScan();
  };

  const handleQuarantine = async (file: InfectedFile) => {
    try {
      await window.electronAPI.quarantineFile(file);
      // Remove from local result list
      if (result) {
        setResult({
          ...result,
          infectedFiles: result.infectedFiles.filter((f) => f.path !== file.path),
        });
      }
      alert(`✅ Quarantined: ${file.path}`);
    } catch (err) {
      alert(`❌ Failed to quarantine: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const modeDescription: Record<ScanMode, string> = {
    quick: 'Scans Downloads, Desktop, Documents and temp folders',
    full: 'Scans the entire file system (may take a long time)',
    custom: 'Choose a specific file or folder to scan',
  };

  return (
    <div className="scan-page">
      <div className="page-header">
        <h1>🔍 Scan</h1>
        <p>Select a scan mode and start scanning your system</p>
      </div>

      {/* Scan mode selector */}
      <div className="card scan-options-card">
        <h2 className="card-section-title">Scan Mode</h2>
        <div className="scan-mode-tabs">
          {(['quick', 'full', 'custom'] as ScanMode[]).map((m) => (
            <button
              key={m}
              className={`scan-mode-tab ${mode === m ? 'active' : ''}`}
              onClick={() => setMode(m)}
              disabled={scanning}
            >
              {m === 'quick' ? '⚡' : m === 'full' ? '🔎' : '📁'}{' '}
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
        <p className="scan-mode-desc">{modeDescription[mode]}</p>

        {mode === 'custom' && (
          <div className="custom-path-row">
            <input
              className="form-input custom-path-input"
              value={customPath}
              onChange={(e) => setCustomPath(e.target.value)}
              placeholder="Enter path or click Browse…"
              disabled={scanning}
            />
            <button className="btn btn-ghost btn-sm" onClick={handleBrowse} disabled={scanning}>
              📁 Browse
            </button>
          </div>
        )}

        <div className="scan-controls">
          {!scanning ? (
            <button
              className="btn btn-primary scan-btn"
              onClick={handleStartScan}
              disabled={mode === 'custom' && !customPath}
            >
              ▶ Start Scan
            </button>
          ) : (
            <button className="btn btn-danger scan-btn" onClick={handleCancel}>
              ⏹ Cancel Scan
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      {scanning && (
        <div className="card scan-progress-card">
          <div className="scan-progress-header">
            <span className="spinner" />
            <span className="scan-progress-title">Scanning…</span>
          </div>
          {progress && (
            <>
              <div className="scan-progress-stats">
                <div className="stat">
                  <span className="stat-label">Files scanned</span>
                  <span className="stat-val">{progress.scannedFiles.toLocaleString()}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Directories</span>
                  <span className="stat-val">{progress.scannedDirectories.toLocaleString()}</span>
                </div>
              </div>
              <div className="current-file text-mono text-muted">
                {progress.currentFile.length > 80
                  ? '…' + progress.currentFile.slice(-77)
                  : progress.currentFile}
              </div>
            </>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="card error-card">
          <strong className="text-danger">⚠ Scan Error</strong>
          <p className="text-muted" style={{ marginTop: 6 }}>{error}</p>
        </div>
      )}

      {/* Results */}
      {result && !scanning && (
        <div className="card results-card">
          <div className="results-header">
            <div>
              <h2 className="card-section-title">
                Scan Results
                {result.infectedFiles.length > 0 && (
                  <span className="badge badge-danger" style={{ marginLeft: 10 }}>
                    {result.infectedFiles.length} threat{result.infectedFiles.length !== 1 ? 's' : ''}
                  </span>
                )}
                {result.infectedFiles.length === 0 && result.status === 'completed' && (
                  <span className="badge badge-success" style={{ marginLeft: 10 }}>Clean</span>
                )}
              </h2>
              <p className="text-muted" style={{ marginTop: 4, fontSize: 12 }}>
                {result.scannedFiles.toLocaleString()} files · {result.scannedDirectories.toLocaleString()} dirs ·{' '}
                {new Date(result.startedAt).toLocaleString()}
              </p>
            </div>
            <span className={`badge ${
              result.status === 'completed' ? (result.infectedFiles.length ? 'badge-danger' : 'badge-success') :
              result.status === 'cancelled' ? 'badge-warning' :
              result.status === 'error' ? 'badge-danger' : 'badge-muted'
            }`}>{result.status}</span>
          </div>
          {result.infectedFiles.length > 0 ? (
            <ResultsTable
              files={result.infectedFiles}
              onQuarantine={handleQuarantine}
            />
          ) : (
            <div className="empty-state">
              <span className="empty-icon">✅</span>
              <span>No threats detected</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ScanPage;
