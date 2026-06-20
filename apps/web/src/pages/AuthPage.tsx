// PC 登录/注册 — 左右分栏布局
import { useState } from 'react';
import { auth, setStoredAuth } from '../api/v2-client';
import { useNavigate } from 'react-router-dom';

export default function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = mode === 'login'
        ? await auth.login({ email, password })
        : await auth.register({ email, password, displayName });
      setStoredAuth(res);
      navigate('/overview');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex">
      {/* 左侧品牌区域 */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-indigo-600 to-purple-700 items-center justify-center p-12">
        <div className="max-w-md">
          <h1 className="text-4xl font-bold text-white tracking-tight mb-4">RiceFinance</h1>
          <p className="text-indigo-200 text-lg leading-relaxed mb-8">
            个人资产汇总、结构分析与 AI 财务复盘。<br />
            不记账，只做"财务体检"。
          </p>
          <div className="space-y-3">
            {[
              { title: '资产汇总', desc: '现金、存款、股票、基金一站式管理' },
              { title: '结构分析', desc: '类型、风险、流动性多维度透视' },
              { title: '月度快照', desc: '追踪净资产变化趋势' },
              { title: 'AI 复盘', desc: '每月一份自动生成的财务报告' },
            ].map((item) => (
              <div key={item.title} className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <p className="text-white font-medium text-sm">{item.title}</p>
                <p className="text-indigo-200 text-xs mt-0.5">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 右侧登录表单 */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8 lg:hidden">
            <h1 className="text-2xl font-bold text-gray-800">RiceFinance</h1>
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
            <h2 className="text-xl font-semibold text-gray-800">{mode === 'login' ? '登录' : '创建账号'}</h2>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">邮箱</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                placeholder="your@email.com" required />
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">昵称</label>
                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder="可选" />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">密码</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                required minLength={8} placeholder="至少 8 位字符" />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {loading ? '请稍候...' : mode === 'login' ? '登录' : '注册'}
            </button>

            <div className="text-center">
              <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                className="text-sm text-indigo-600 hover:text-indigo-800">
                {mode === 'login' ? '没有账号？去注册' : '已有账号？去登录'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
