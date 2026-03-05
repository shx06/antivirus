import React from 'react';
import type { InfectedFile } from '../../shared/types';

interface ResultsTableProps {
  files: InfectedFile[];
  onQuarantine?: (file: InfectedFile) => void;
  showQuarantine?: boolean;
}

const ResultsTable: React.FC<ResultsTableProps> = ({
  files,
  onQuarantine,
  showQuarantine = true,
}) => {
  if (files.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-icon">✅</span>
        <span>No threats found</span>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>File Path</th>
            <th>Signature / Threat</th>
            <th>Detected At</th>
            {showQuarantine && onQuarantine && <th style={{ width: 100 }}>Action</th>}
          </tr>
        </thead>
        <tbody>
          {files.map((file, i) => (
            <tr key={i}>
              <td>
                <span
                  className="text-mono text-danger"
                  title={file.path}
                  style={{ display: 'block', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {file.path}
                </span>
              </td>
              <td>
                <span className="badge badge-danger">{file.signature}</span>
              </td>
              <td>
                <span className="text-muted" style={{ fontSize: 12 }}>
                  {new Date(file.discoveredAt).toLocaleString()}
                </span>
              </td>
              {showQuarantine && onQuarantine && (
                <td>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => onQuarantine(file)}
                    title="Move to quarantine"
                  >
                    🔒 Quarantine
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ResultsTable;
