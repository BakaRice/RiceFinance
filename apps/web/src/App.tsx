import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AppProvider } from './store/AppContext';
import Layout from './components/Layout';
import AuthPage from './pages/AuthPage';
import OverviewPage from './pages/OverviewPage';
import AssetsPage from './pages/AssetsPage';
import AnalysisPage from './pages/AnalysisPage';
import SnapshotsPage from './pages/SnapshotsPage';
import AIPage from './pages/AIPage';
import AssetJsonPage from './pages/AssetJsonPage';
import { getStoredAuth, setAuthExpiredHandler, setErrorHandler } from './api/v2-client';

// 全局 Toast
let toastId = 0;
function showToast(msg: string, type: 'error' | 'info' = 'error') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const id = ++toastId;
  const el = document.createElement('div');
  el.className = `px-4 py-2.5 rounded-lg text-sm shadow-lg font-medium animate-slide-in ${
    type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-800 text-white'
  }`;
  el.textContent = msg;
  el.id = `toast-${id}`;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('animate-slide-out');
    setTimeout(() => el.remove(), 300);
  }, 4000);
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const auth = getStoredAuth();
  if (!auth) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// 内部路由组件，可以 useNavigate
function AppInner() {
  const navigate = useNavigate();

  useEffect(() => {
    // 注册全局错误回调
    setErrorHandler((msg) => showToast(msg, 'error'));

    // 认证过期 → 跳转登录页
    setAuthExpiredHandler(() => {
      navigate('/');
    });
  }, [navigate]);

  return (
    <Routes>
      <Route path="/" element={<AuthPage />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <AppProvider>
              <Layout>
                <Routes>
                  <Route path="/overview" element={<OverviewPage />} />
                  <Route path="/assets" element={<AssetsPage />} />
                  <Route path="/analysis" element={<AnalysisPage />} />
                  <Route path="/snapshots" element={<SnapshotsPage />} />
                  <Route path="/ai" element={<AIPage />} />
                  <Route path="/asset-json" element={<AssetJsonPage />} />
                  <Route path="*" element={<Navigate to="/overview" replace />} />
                </Routes>
              </Layout>
            </AppProvider>
          </RequireAuth>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
      {/* Toast 容器 */}
      <div
        id="toast-container"
        className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
      />
    </BrowserRouter>
  );
}
