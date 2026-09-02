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
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: sans-serif; background-color: #f8fafc; color: #1e293b; padding: 24px; text-align: center;">
        <div style="max-width: 420px; background: white; border: 1px solid #e2e8f0; border-radius: 20px; padding: 24px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05);">
          <div style="color: #dc2626; font-size: 16px; font-weight: 700; margin-bottom: 8px;">เกิดข้อผิดพลาดในการโหลดระบบ</div>
          <div style="color: #64748b; font-size: 13px; line-height: 1.6; margin-bottom: 16px;">${err?.message || 'ไม่สามารถเริ่มต้นแอปพลิเคชันได้'}</div>
          <button onclick="window.location.reload()" style="padding: 8px 18px; background: #7c3aed; color: #ffffff; border: none; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer;">ลองใหม่อีกครั้ง</button>
        </div>
      </div>
    `;
  }
}

