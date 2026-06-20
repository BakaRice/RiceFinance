// PC 净值快照 — 趋势图 + 数据表
import { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAppContext, genClientUid } from '../store/AppContext';
import { formatCurrency, formatDateTime } from '../lib/formatters';

export default function SnapshotsPage() {
  const { assets, liabilities, snapshots, addSnapshot } = useAppContext();
  const [msg, setMsg] = useState('');

  // 按日期升序（用于图表）
  const sorted = useMemo(
    () => [...snapshots].sort((a, b) => new Date(a.snapshotDate).getTime() - new Date(b.snapshotDate).getTime()),
    [snapshots],
  );

  // 趋势图数据
  const chartData = useMemo(() =>
    sorted.map((s) => ({
      date: new Date(s.snapshotDate).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
      netWorth: parseFloat(s.netWorth),
      totalAssets: parseFloat(s.totalAssets),
      totalLiabilities: parseFloat(s.totalLiabilities),
    })),
    [sorted]);

  const handleSnapshot = async () => {
    if (assets.length === 0 && liabilities.length === 0) return;
    try {
      await addSnapshot({
        clientUid: genClientUid(),
        snapshotDate: new Date().toISOString(),
        currency: 'CNY',
      });
      setMsg('快照已生成');
      setTimeout(() => setMsg(''), 2500);
    } catch {
      setMsg('快照生成失败');
      setTimeout(() => setMsg(''), 2500);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {msg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-5 py-2.5 rounded-lg text-sm shadow-lg z-50">
          {msg}
        </div>
      )}

      {/* 趋势图 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">净资产趋势</h3>
            <p className="text-xs text-gray-400 mt-0.5">历史快照变化</p>
          </div>
          <button onClick={handleSnapshot}
            disabled={assets.length === 0 && liabilities.length === 0}
            className="bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-40 transition-colors">
            📸 生成本月快照
          </button>
        </div>

        {chartData.length < 2 ? (
          <div className="text-center py-16 text-sm text-gray-400">
            {chartData.length === 0
              ? '暂无快照数据，点击"生成本月快照"开始追踪'
              : '至少需要 2 次快照才能展示趋势'}
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => formatCurrency(v as number)} />
                <Tooltip formatter={(v) => formatCurrency(v as number)} />
                <Line type="monotone" dataKey="netWorth" name="净资产" stroke="#6366F1" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="totalAssets" name="总资产" stroke="#22C55E" strokeWidth={1.5} dot={{ r: 2 }} strokeDasharray="5 5" />
                <Line type="monotone" dataKey="totalLiabilities" name="总负债" stroke="#EF4444" strokeWidth={1.5} dot={{ r: 2 }} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 快照列表表格 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">历史快照</h3>
          <span className="text-xs text-gray-400">{sorted.length} 条记录</span>
        </div>

        {sorted.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-gray-400 mb-3">暂无快照</p>
            <button onClick={handleSnapshot} className="text-sm text-green-600 hover:text-green-800 font-medium border border-green-200 rounded-lg px-4 py-2 hover:bg-green-50 transition-colors">
              生成首次快照
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">日期</th>
                <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider text-right">总资产</th>
                <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider text-right">总负债</th>
                <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider text-right">净资产</th>
                <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">备注</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.reverse().map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 text-gray-700">{formatDateTime(s.snapshotDate)}</td>
                  <td className="px-5 py-3 text-right font-medium text-green-600 tabular-nums">{formatCurrency(s.totalAssets)}</td>
                  <td className="px-5 py-3 text-right font-medium text-red-600 tabular-nums">{formatCurrency(s.totalLiabilities)}</td>
                  <td className="px-5 py-3 text-right font-bold text-gray-900 tabular-nums">{formatCurrency(s.netWorth)}</td>
                  <td className="px-5 py-3 text-gray-400">{s.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
