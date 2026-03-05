import React, { useEffect, useState } from 'react';
import type { ScanResult } from '../../shared/types';
import './HistoryPage.css';

const HistoryPage: React.FC = () => {
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const h = await window.electronAPI.getHistory();
      setHistory(h);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleClear = async () => {
    if (!confirm('Clear all scan history? This cannot be undone.')) return;
    await window.electronAPI.clearHistory();
    setHistory([]);
  };

  const formatDuration = (start: string, end?: string) => {
    if (!end) return '—';
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  };

  return (
    <div className="history-page">
      <div className="page-header">
        <h1>📋 History</h1>
        <p>Past scan results</p>
      </div>

      <div className="card">
        <div className="history-header">
          <span className="card-section-title">
            Scan History
            {history.length > 0 && (
              <span className="badge badge-info" style={{ marginLeft: 10 }}>{history.length}</span>
            )}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={loadHistory} disabled={loading}>
              ↻ Refresh
            </button>
            {history.length > 0 && (
              <button className="btn btn-ghost btn-sm text-danger" onClick={handleClear}>
                🗑 Clear
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <span className="spinner" />
          </div>
        ) : history.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📋</span>
            <span>No scan history yet</span>
          </div>
        ) : (
          <div className="history-list">
            {history.map((item) => (
              <div key={item.id} className="history-item">
                <button
                  className="history-item-header"
                  onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                >
                  <div className="history-item-left">
                    <span className={`badge ${
                      item.status === 'completed' ? (item.infectedFiles.length ? 'badge-danger' : 'badge-success') :
                      item.status === 'cancelled' ? 'badge-warning' :
                      item.status === 'error' ? 'badge-danger' : 'badge-muted'
                    }`}>{item.status}</span>
                    <span className="history-mode">
                      {item.mode.charAt(0).toUpperCase() + item.mode.slice(1)} Scan
                    </span>
                    <span className="history-date text-muted">
                      {new Date(item.startedAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="history-item-right">
                    {item.infectedFiles.length > 0 && (
                      <span className="badge badge-danger">
                        {item.infectedFiles.length} threat{item.infectedFiles.length !== 1 ? 's' : ''}
                      </span>
                    )}
                    <span className="history-files text-muted">
                      {item.scannedFiles.toLocaleString()} files
                    </span>
                    <span className="history-duration text-muted">
                      ⏱ {formatDuration(item.startedAt, item.finishedAt)}
                    </span>
                    <span className="expand-arrow">{expanded === item.id ? '▲' : '▼'}</span>
                  </div>
                </button>

                {expanded === item.id && (
                  <div className="history-item-body">
                    {item.errorMessage && (
                      <div className="error-msg text-danger" style={{ marginBottom: 10 }}>
                        ⚠ {item.errorMessage}
                      </div>
                    )}
                    {item.infectedFiles.length === 0 ? (
                      <div className="text-muted" style={{ fontSize: 12 }}>No threats detected in this scan.</div>
                    ) : (
                      <table className="data-table" style={{ marginTop: 0 }}>
                        <thead>
                          <tr>
                            <th>File</th>
                            <th>Signature</th>
                            <th>Detected At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {item.infectedFiles.map((f, i) => (
                            <tr key={i}>
                              <td className="text-mono text-danger" style={{ fontSize: 11 }}>{f.path}</td>
                              <td><span className="badge badge-danger">{f.signature}</span></td>
                              <td className="text-muted" style={{ fontSize: 11 }}>
                                {new Date(f.discoveredAt).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryPage;
