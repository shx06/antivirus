import React, { useEffect, useState } from 'react';
import type { Page } from '../App';
import type { ClamAVStatus, ScanResult } from '../../shared/types';
import './Dashboard.css';

interface DashboardProps {
  onNavigate: (page: Page) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [clamavStatus, setClamavStatus] = useState<ClamAVStatus | null>(null);
  const [lastScan, setLastScan] = useState<ScanResult | null>(null);
  const [checkingClamav, setCheckingClamav] = useState(false);

  useEffect(() => {
    // Load last scan from history
    window.electronAPI?.getHistory().then((history) => {
      if (history.length > 0) setLastScan(history[0]);
    }).catch(() => {});

    // Check ClamAV
    checkClamav();
  }, []);

  const checkClamav = async () => {
    setCheckingClamav(true);
    try {
      const status = await window.electronAPI.checkClamAV();
      setClamavStatus(status);
    } catch {
      setClamavStatus({ found: false, path: '', error: 'Failed to check ClamAV status.' });
    } finally {
      setCheckingClamav(false);
    }
  };

  const formatDate = (iso?: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString();
  };

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1>🛡️ Dashboard</h1>
        <p>System protection overview</p>
      </div>

      {/* ClamAV Status */}
      <div className="card dashboard-status-card">
        <div className="status-row">
          <div className="status-icon-wrap">
            {checkingClamav ? (
              <span className="spinner" />
            ) : clamavStatus?.found ? (
              <span className="status-icon status-ok">✓</span>
            ) : (
              <span className="status-icon status-err">✗</span>
            )}
          </div>
          <div className="status-text">
            <div className="status-title">
              {checkingClamav
                ? 'Checking ClamAV…'
                : clamavStatus?.found
                ? 'ClamAV Ready'
                : 'ClamAV Not Found'}
            </div>
            <div className="status-sub">
              {clamavStatus?.found
                ? clamavStatus.version || clamavStatus.path
                : clamavStatus?.error || 'Install ClamAV to enable scanning'}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={checkClamav} disabled={checkingClamav}>
            ↻ Recheck
          </button>
        </div>
        {!clamavStatus?.found && !checkingClamav && (
          <div className="clamav-hint">
            <strong>Install ClamAV:</strong>{' '}
            Windows: <a href="https://www.clamav.net/downloads" target="_blank" rel="noreferrer">clamav.net/downloads</a>{' '}
            · macOS: <code>brew install clamav</code>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="dashboard-actions">
        <button className="action-card" onClick={() => onNavigate('scan')}>
          <span className="action-icon">⚡</span>
          <span className="action-label">Quick Scan</span>
          <span className="action-desc">Downloads, Desktop, Documents</span>
        </button>
        <button className="action-card" onClick={() => onNavigate('scan')}>
          <span className="action-icon">🔍</span>
          <span className="action-label">Full Scan</span>
          <span className="action-desc">Entire file system</span>
        </button>
        <button className="action-card" onClick={() => onNavigate('scan')}>
          <span className="action-icon">📁</span>
          <span className="action-label">Custom Scan</span>
          <span className="action-desc">Select specific folder</span>
        </button>
      </div>

      {/* Last scan */}
      <div className="card last-scan-card">
        <h2 className="card-section-title">Last Scan</h2>
        {lastScan ? (
          <div className="last-scan-info">
            <div className="last-scan-row">
              <span className="last-scan-key">Mode</span>
              <span className="last-scan-val">{lastScan.mode.charAt(0).toUpperCase() + lastScan.mode.slice(1)}</span>
            </div>
            <div className="last-scan-row">
              <span className="last-scan-key">Started</span>
              <span className="last-scan-val">{formatDate(lastScan.startedAt)}</span>
            </div>
            <div className="last-scan-row">
              <span className="last-scan-key">Files scanned</span>
              <span className="last-scan-val">{lastScan.scannedFiles.toLocaleString()}</span>
            </div>
            <div className="last-scan-row">
              <span className="last-scan-key">Threats found</span>
              <span className={`last-scan-val ${lastScan.infectedFiles.length > 0 ? 'text-danger' : 'text-success'}`}>
                {lastScan.infectedFiles.length}
              </span>
            </div>
            <div className="last-scan-row">
              <span className="last-scan-key">Status</span>
              <span className={`badge ${
                lastScan.status === 'completed' ? 'badge-success' :
                lastScan.status === 'error' ? 'badge-danger' :
                lastScan.status === 'cancelled' ? 'badge-warning' :
                'badge-muted'
              }`}>{lastScan.status}</span>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-icon">🔎</span>
            <span>No scans performed yet</span>
          </div>
        )}
        <button className="btn btn-ghost btn-sm view-history-btn" onClick={() => onNavigate('history')}>
          View full history →
        </button>
      </div>
    </div>
  );
};

export default Dashboard;
