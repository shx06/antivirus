import React, { useEffect, useState, useCallback } from 'react';
import type { QuarantineEntry } from '../../shared/types';
import './QuarantinePage.css';

const QuarantinePage: React.FC = () => {
  const [entries, setEntries] = useState<QuarantineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState<string | null>(null);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const list = await window.electronAPI.getQuarantineList();
      setEntries(list);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const handleRestore = async (entry: QuarantineEntry) => {
    if (!confirm(`Restore "${entry.originalPath}" to its original location?`)) return;
    setActionPending(entry.id);
    try {
      const res = await window.electronAPI.restoreFile(entry.id);
      if (res.success) {
        await loadEntries();
      } else {
        alert(`❌ Restore failed: ${res.error}`);
      }
    } finally {
      setActionPending(null);
    }
  };

  const handleDelete = async (entry: QuarantineEntry) => {
    if (!confirm(`Permanently delete "${entry.originalPath}"? This cannot be undone.`)) return;
    setActionPending(entry.id);
    try {
      const res = await window.electronAPI.deleteFromQuarantine(entry.id);
      if (res.success) {
        await loadEntries();
      } else {
        alert(`❌ Delete failed: ${res.error}`);
      }
    } finally {
      setActionPending(null);
    }
  };

  return (
    <div className="quarantine-page">
      <div className="page-header">
        <h1>🔒 Quarantine</h1>
        <p>Files isolated to prevent harm — restore or permanently delete them</p>
      </div>

      <div className="card">
        <div className="quarantine-header">
          <span className="card-section-title">
            Quarantined Files
            {entries.length > 0 && (
              <span className="badge badge-warning" style={{ marginLeft: 10 }}>
                {entries.length}
              </span>
            )}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={loadEntries} disabled={loading}>
            ↻ Refresh
          </button>
        </div>

        {loading ? (
          <div className="empty-state">
            <span className="spinner" />
            <span>Loading quarantine…</span>
          </div>
        ) : entries.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">✅</span>
            <span>Quarantine is empty</span>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Original Path</th>
                  <th>Signature</th>
                  <th>Quarantined At</th>
                  <th style={{ width: 160 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <span
                        className="text-mono"
                        title={entry.originalPath}
                        style={{ display: 'block', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        {entry.originalPath}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-danger">{entry.signature}</span>
                    </td>
                    <td>
                      <span className="text-muted" style={{ fontSize: 12 }}>
                        {new Date(entry.quarantinedAt).toLocaleString()}
                      </span>
                    </td>
                    <td>
                      <div className="quarantine-actions">
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleRestore(entry)}
                          disabled={actionPending === entry.id}
                          title="Restore to original location"
                        >
                          ↩ Restore
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(entry)}
                          disabled={actionPending === entry.id}
                          title="Delete permanently"
                        >
                          🗑 Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuarantinePage;
