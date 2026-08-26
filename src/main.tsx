import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/common/ErrorBoundary.tsx';
import './index.css';

try {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    createRoot(rootElement).render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    );
  }
} catch (err: any) {
  console.error("Fatal error during app initialization:", err);
  const statusEl = document.getElementById('loading-status-text');
  if (statusEl) {
    statusEl.innerHTML = `<span style="color:#ef4444;font-weight:bold;">เกิดข้อผิดพลาดในการโหลดระบบ: ${err?.message || err}</span>`;
  }
  const fallbackBox = document.getElementById('loading-fallback-box');
  if (fallbackBox) {
    fallbackBox.style.display = 'block';
  }
}

