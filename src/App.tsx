import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ScanPage from './components/ScanPage';
import QuarantinePage from './components/QuarantinePage';
import HistoryPage from './components/HistoryPage';
import SettingsPage from './components/SettingsPage';
import type { AppSettings } from '../shared/types';
import './styles/app.css';

export type Page = 'dashboard' | 'scan' | 'quarantine' | 'history' | 'settings';

const App: React.FC = () => {
  const [page, setPage] = useState<Page>('dashboard');
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');

  useEffect(() => {
    // Load theme from settings
    window.electronAPI?.getSettings().then((settings: AppSettings) => {
      setTheme(settings.theme);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    let effective = theme;
    if (theme === 'system') {
      effective = window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark';
    }
    document.documentElement.setAttribute(
      'data-theme',
      effective === 'light' ? 'light' : 'dark'
    );
  }, [theme]);

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return <Dashboard onNavigate={setPage} />;
      case 'scan':
        return <ScanPage />;
      case 'quarantine':
        return <QuarantinePage />;
      case 'history':
        return <HistoryPage />;
      case 'settings':
        return <SettingsPage onThemeChange={setTheme} />;
      default:
        return <Dashboard onNavigate={setPage} />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar currentPage={page} onNavigate={setPage} />
      <main className="app-main">
        {renderPage()}
      </main>
    </div>
  );
};

export default App;
