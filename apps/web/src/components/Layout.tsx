// PC Dashboard 布局 — 侧边栏 + 宽屏内容区
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { getStoredAuth, clearStoredAuth } from '../api/v2-client';

const NAV_ITEMS = [
  { path: '/overview', label: '总览', icon: 'home' },
  { path: '/assets', label: '资产管理', icon: 'wallet' },
  { path: '/analysis', label: '结构分析', icon: 'pie-chart' },
  { path: '/snapshots', label: '净值快照', icon: 'camera' },
  { path: '/ai', label: 'AI 复盘', icon: 'sparkles' },
  { path: '/asset-json', label: '资产 JSON', icon: 'braces' },
];

const ICON_SVG: Record<string, string> = {
  home: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  wallet: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="12" y1="9" x2="12" y2="15"/><line x1="9" y1="12" x2="15" y2="12"/></svg>`,
  'pie-chart': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>`,
  camera: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
  sparkles: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z"/><path d="M19 15l.5 2L21 17.5l-1.5.5-.5 2-.5-2L17 17.5l1.5-.5z"/></svg>`,
  braces: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H7a4 4 0 0 0-4 4v2a2 2 0 0 1-2 2 2 2 0 0 1 2 2v2a4 4 0 0 0 4 4h1"/><path d="M16 3h1a4 4 0 0 1 4 4v2a2 2 0 0 0 2 2 2 2 0 0 0-2 2v2a4 4 0 0 1-4 4h-1"/></svg>`,
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const authData = getStoredAuth();
  const currentPage = NAV_ITEMS.find((i) => i.path === location.pathname);

  const handleLogout = () => {
    clearStoredAuth();
    navigate('/');
  };

  return (
    <div className="h-screen flex bg-gray-50 overflow-hidden">
      {/* 侧边栏 */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-100">
          <h1 className="text-lg font-bold text-gray-900 tracking-tight">RiceFinance</h1>
          <p className="text-xs text-gray-400 mt-0.5">个人资产管理系统</p>
        </div>

        {/* 导航 */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                  active
                    ? 'bg-indigo-50 text-indigo-700 font-medium shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <span
                  className={`shrink-0 ${active ? 'text-indigo-600' : 'text-gray-400'}`}
                  dangerouslySetInnerHTML={{ __html: ICON_SVG[item.icon] }}
                />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* 底部用户信息 */}
        {authData && (
          <div className="px-5 py-4 border-t border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">
                {(authData.user.displayName || authData.user.email)[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 truncate">
                  {authData.user.displayName || authData.user.email}
                </p>
                <p className="text-[11px] text-gray-400 truncate">{authData.user.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="mt-3 w-full text-xs text-gray-400 hover:text-red-500 transition-colors text-left"
            >
              退出登录
            </button>
          </div>
        )}
      </aside>

      {/* 内容区 */}
      <main className="flex-1 overflow-auto">
        {/* 顶部标题栏 */}
        {currentPage && (
          <div className="sticky top-0 bg-white/80 backdrop-blur-sm border-b border-gray-100 px-8 py-4 z-10">
            <h2 className="text-base font-semibold text-gray-900">{currentPage.label}</h2>
          </div>
        )}
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
