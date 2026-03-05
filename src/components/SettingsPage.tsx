import React, { useEffect, useState } from 'react';
import type { AppSettings } from '../../shared/types';
import { DEFAULT_SETTINGS } from '../../shared/types';
import './SettingsPage.css';

interface SettingsPageProps {
  onThemeChange: (theme: 'light' | 'dark' | 'system') => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ onThemeChange }) => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [clamavChecking, setClamavChecking] = useState(false);
  const [clamavMsg, setClamavMsg] = useState<string | null>(null);

  useEffect(() => {
    window.electronAPI?.getSettings().then(setSettings).catch(() => {});
  }, []);

  const handleSave = async () => {
    await window.electronAPI.saveSettings(settings);
    onThemeChange(settings.theme);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleBrowseClamscan = async () => {
    const execFilters =
      process.platform === 'win32'
        ? [{ name: 'Executable', extensions: ['exe'] }]
        : [{ name: 'All Files', extensions: ['*'] }];
    const file = await window.electronAPI.selectFile(execFilters);
    if (file) setSettings((s) => ({ ...s, clamscanPath: file }));
  };

  const handleTestClamav = async () => {
    setClamavChecking(true);
    setClamavMsg(null);
    try {
      const status = await window.electronAPI.checkClamAV();
      if (status.found) {
        setClamavMsg(`✅ Found: ${status.path} — ${status.version}`);
      } else {
        setClamavMsg(`❌ Not found: ${status.error}`);
      }
    } finally {
      setClamavChecking(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1>⚙️ Settings</h1>
        <p>Configure the application</p>
      </div>

      <div className="card settings-card">
        {/* ClamAV */}
        <section className="settings-section">
          <h3 className="settings-section-title">ClamAV</h3>
          <div className="form-group">
            <label className="form-label">clamscan Path (leave blank to auto-detect)</label>
            <div className="path-row">
              <input
                className="form-input"
                value={settings.clamscanPath}
                onChange={(e) => setSettings((s) => ({ ...s, clamscanPath: e.target.value }))}
                placeholder="Auto-detect from PATH"
                style={{ flex: 1 }}
              />
              <button className="btn btn-ghost btn-sm" onClick={handleBrowseClamscan}>
                📁 Browse
              </button>
              <button className="btn btn-ghost btn-sm" onClick={handleTestClamav} disabled={clamavChecking}>
                {clamavChecking ? '…' : '🔍 Test'}
              </button>
            </div>
            {clamavMsg && (
              <div className={`clamav-test-msg ${clamavMsg.startsWith('✅') ? 'ok' : 'err'}`}>
                {clamavMsg}
              </div>
            )}
          </div>
        </section>

        {/* Quarantine */}
        <section className="settings-section">
          <h3 className="settings-section-title">Quarantine</h3>
          <div className="form-group">
            <label className="form-label">Quarantine Directory (leave blank for default)</label>
            <input
              className="form-input"
              value={settings.quarantineDir}
              onChange={(e) => setSettings((s) => ({ ...s, quarantineDir: e.target.value }))}
              placeholder="Default: <userData>/quarantine"
            />
          </div>
        </section>

        {/* History */}
        <section className="settings-section">
          <h3 className="settings-section-title">History</h3>
          <div className="form-group">
            <label className="form-label">Max History Entries</label>
            <input
              type="number"
              className="form-input"
              value={settings.maxHistoryEntries}
              onChange={(e) =>
                setSettings((s) => ({ ...s, maxHistoryEntries: Math.max(1, parseInt(e.target.value, 10) || 1) }))
              }
              min={1}
              max={500}
              style={{ width: 120 }}
            />
          </div>
        </section>

        {/* Appearance */}
        <section className="settings-section">
          <h3 className="settings-section-title">Appearance</h3>
          <div className="form-group">
            <label className="form-label">Theme</label>
            <div className="theme-selector">
              {(['light', 'dark', 'system'] as const).map((t) => (
                <button
                  key={t}
                  className={`theme-btn ${settings.theme === t ? 'active' : ''}`}
                  onClick={() => setSettings((s) => ({ ...s, theme: t }))}
                >
                  {t === 'light' ? '☀️ Light' : t === 'dark' ? '🌙 Dark' : '🖥️ System'}
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="settings-footer">
          <button className="btn btn-primary" onClick={handleSave}>
            💾 Save Settings
          </button>
          {saved && <span className="save-confirm text-success">✓ Settings saved!</span>}
        </div>
      </div>

      {/* ClamAV install guide */}
      <div className="card">
        <h2 className="card-section-title">ClamAV Installation Guide</h2>
        <div className="install-guide">
          <h4>Windows</h4>
          <ol>
            <li>Download from <a href="https://www.clamav.net/downloads" target="_blank" rel="noreferrer">clamav.net/downloads</a></li>
            <li>Run the installer and note the install directory (e.g., <code>C:\Program Files\ClamAV</code>)</li>
            <li>Copy <code>freshclam.conf.sample</code> → <code>freshclam.conf</code> and remove the <code>Example</code> line</li>
            <li>Run <code>freshclam</code> in the ClamAV directory to download virus definitions</li>
            <li>Set the clamscan path above to <code>C:\Program Files\ClamAV\clamscan.exe</code></li>
          </ol>
          <h4>macOS (Homebrew)</h4>
          <ol>
            <li>Install Homebrew: <a href="https://brew.sh" target="_blank" rel="noreferrer">brew.sh</a></li>
            <li>Run: <code>brew install clamav</code></li>
            <li>Configure freshclam: <code>cp $(brew --prefix)/etc/clamav/freshclam.conf.sample $(brew --prefix)/etc/clamav/freshclam.conf</code></li>
            <li>Run: <code>freshclam</code></li>
            <li>Leave the path blank (auto-detected from <code>/opt/homebrew/bin/clamscan</code>)</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
