// PC Dashboard 首页 — KPI 卡片 + 图表 + 快照表 + 状态面板
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useAppContext, genClientUid } from '../store/AppContext';
import { makeSummary } from '../lib/summary';
import { formatCurrency, formatPercent, formatDate } from '../lib/formatters';
import { stats } from '../api/v2-client';
import type { V2AccountBreakdown, V2CurrencyBreakdown, V2OverviewResponse } from '../api/v2-types';

// ===== 颜色 =====
const TYPE_COLORS: Record<string, string> = {
  cash: '#00C7BE', deposit: '#3B82F6', fixedIncome: '#14B8A6',
  fund: '#6366F1', stock: '#EF4444', commodity: '#F97316',
  foreignCurrency: '#06B6D4', housingFund: '#F59E0B', other: '#6B7280',
};

const RISK_COLORS: Record<string, string> = { low: '#22C55E', medium: '#F59E0B', high: '#EF4444' };

function toNumber(value: string | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === 'string' ? parseFloat(value) || 0 : value;
}

// ===== 财务状态判断 =====
function getFinancialStatus(summary: ReturnType<typeof makeSummary>) {
  const { totalAssets, totalLiabilities, typeAllocations } = summary;
  if (totalAssets <= 0) return { label: '等待录入', color: 'text-gray-400', bg: 'bg-gray-50', desc: '录入资产后自动分析' };

  const liabilityRatio = totalLiabilities / (totalAssets || 1);
  if (liabilityRatio > 0.5) return { label: '负债偏高', color: 'text-orange-600', bg: 'bg-orange-50', desc: '负债超过总资产50%，建议关注偿债能力' };

  const def = typeAllocations.filter((a) => ['现金', '存款', '固定收益'].includes(a.title)).reduce((s, a) => s + a.ratio, 0);
  const eq = typeAllocations.filter((a) => ['基金', '股票'].includes(a.title)).reduce((s, a) => s + a.ratio, 0);

  if (def >= 0.6 && eq < 0.25) return { label: '稳健增长', color: 'text-green-600', bg: 'bg-green-50', desc: '防守型资产充足，风险可控' };
  if (eq >= 0.45) return { label: '增长进取', color: 'text-red-600', bg: 'bg-red-50', desc: '权益类占比偏高，波动可能较大' };
  return { label: '结构均衡', color: 'text-blue-600', bg: 'bg-blue-50', desc: '资产配置较为均衡' };
}

export default function OverviewPage() {
  const { assets, liabilities, snapshots, addSnapshot } = useAppContext();
  const navigate = useNavigate();
  const [msg, setMsg] = useState('');
  const [remoteOverview, setRemoteOverview] = useState<V2OverviewResponse | null>(null);
  const [overviewError, setOverviewError] = useState('');
  const summary = useMemo(() => makeSummary(assets, liabilities, snapshots), [assets, liabilities, snapshots]);
  const effectiveSummary = useMemo(() => {
    if (!remoteOverview) return summary;
    return {
      ...summary,
      totalAssets: toNumber(remoteOverview.totalAssets),
      totalLiabilities: toNumber(remoteOverview.totalLiabilities),
      netWorth: toNumber(remoteOverview.netWorth),
    };
  }, [remoteOverview, summary]);
  const status = getFinancialStatus(effectiveSummary);
  const baseCurrency = remoteOverview?.baseCurrency ?? 'CNY';

  useEffect(() => {
    let alive = true;
    stats.overview()
      .then((data) => {
        if (alive) {
          setRemoteOverview(data);
          setOverviewError('');
        }
      })
      .catch((err) => {
        if (alive) {
          setRemoteOverview(null);
          setOverviewError((err as Error).message);
        }
      });
    return () => {
      alive = false;
    };
  }, [assets, liabilities]);

  // 饼图数据
  const pieData = useMemo(() => {
    const active = assets.filter((a) => !a.deletedAt);
    const groups: Record<string, number> = {};
    for (const a of active) {
      const k = a.type || 'other';
      groups[k] = (groups[k] || 0) + parseFloat(a.amount);
    }
    return Object.entries(groups)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ name: typeLabel(k), value: v, color: TYPE_COLORS[k] || '#6B7280' }))
      .sort((a, b) => b.value - a.value);
  }, [assets]);

  // 风险分布
  const riskData = useMemo(() => {
    const active = assets.filter((a) => !a.deletedAt);
    const groups: Record<string, number> = {};
    for (const a of active) groups[a.risk] = (groups[a.risk] || 0) + parseFloat(a.amount);
    return Object.entries(groups)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ name: riskLabel(k), value: v, pct: summary.totalAssets > 0 ? v / summary.totalAssets * 100 : 0 }));
  }, [assets, summary.totalAssets]);

  // 快照列表（最近5条）
  const recentSnapshots = useMemo(() =>
    [...snapshots].sort((a, b) => new Date(b.snapshotDate).getTime() - new Date(a.snapshotDate).getTime()).slice(0, 5),
    [snapshots]);

  // 最大资产
  const largestAsset = useMemo(() => {
    const active = assets.filter((a) => !a.deletedAt);
    return active.length > 0 ? active.reduce((max, a) => parseFloat(a.amount) > parseFloat(max.amount) ? a : max) : null;
  }, [assets]);

  // 生成快照
  const handleSnapshot = async () => {
    if (assets.length === 0 && liabilities.length === 0) return;
    try {
      await addSnapshot({
        clientUid: genClientUid(),
        snapshotDate: new Date().toISOString(),
        currency: 'CNY',
      });
      setMsg('快照已生成');
      setTimeout(() => setMsg(''), 2000);
    } catch { setMsg('生成失败'); }
  };

  const KPI_CARDS = [
    { label: '净资产', value: formatCurrency(effectiveSummary.netWorth, baseCurrency), sub: summary.netWorthChange != null ? `${summary.netWorthChange >= 0 ? '+' : ''}${formatCurrency(summary.netWorthChange)}` : null, positive: (summary.netWorthChange ?? 0) >= 0, color: 'text-gray-900' },
    { label: '总资产', value: formatCurrency(effectiveSummary.totalAssets, baseCurrency), sub: `${assets.filter((a) => !a.deletedAt).length} 个账户 · ${baseCurrency} 折算`, positive: null, color: 'text-green-600' },
    { label: '总负债', value: formatCurrency(effectiveSummary.totalLiabilities, baseCurrency), sub: effectiveSummary.totalAssets > 0 ? `占比 ${formatPercent(effectiveSummary.totalLiabilities / effectiveSummary.totalAssets)}` : null, positive: null, color: 'text-red-600' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {msg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm shadow-lg z-50 animate-pulse">
          {msg}
        </div>
      )}

      {/* ===== KPI 指标卡 ===== */}
      <div className="grid grid-cols-3 gap-4">
        {KPI_CARDS.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{kpi.label}</p>
            <p className={`text-2xl font-bold mt-2 tracking-tight tabular-nums ${kpi.color}`}>{kpi.value}</p>
            {kpi.sub && (
              <p className={`text-xs mt-1.5 ${kpi.positive === null ? 'text-gray-400' : kpi.positive ? 'text-green-600' : 'text-red-500'}`}>
                {kpi.sub}
              </p>
            )}
          </div>
        ))}
      </div>

      {overviewError && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-xs text-orange-700">
          后端总览暂不可用，当前显示本地计算结果
        </div>
      )}

      {/* ===== 中间行：资产分布图 + 账户概览 ===== */}
      <div className="grid grid-cols-2 gap-4">
        {/* 资产类型分布（饼图） */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">资产类型分布</h3>
          {pieData.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">暂无数据</p>
          ) : (
            <div className="flex items-center gap-6">
              <div className="w-40 h-40 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={70} paddingAngle={2} dataKey="value">
                      {pieData.map((d, i) => (<Cell key={i} fill={d.color} stroke="none" />))}
                    </Pie>
                    <Tooltip formatter={(v) => formatCurrency(v as number)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {pieData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-gray-600 flex-1">{d.name}</span>
                    <span className="text-gray-900 font-medium tabular-nums">{formatCurrency(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 账户总览 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">账户概览</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">资产账户</span>
              <span className="text-sm font-medium">{assets.filter((a) => !a.deletedAt).length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">负债账户</span>
              <span className="text-sm font-medium">{liabilities.filter((l) => !l.deletedAt).length}</span>
            </div>
            {largestAsset && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">最大持仓</span>
                <span className="text-sm font-medium">{largestAsset.name} ({formatCurrency(largestAsset.amount)})</span>
              </div>
            )}
            <hr className="border-gray-100" />
            {/* 风险分布条形 */}
            <div>
              <p className="text-xs text-gray-400 mb-2">风险分布</p>
              <div className="flex h-5 rounded-full overflow-hidden gap-0.5">
                {riskData.map((r) => (
                  <div key={r.name}
                    className="h-full transition-all"
                    style={{ width: `${Math.max(r.pct, 2)}%`, backgroundColor: RISK_COLORS[Object.keys(RISK_COLORS).find(k => riskLabel(k) === r.name) || 'medium'] }}
                    title={`${r.name}: ${r.pct.toFixed(1)}%`}
                  />
                ))}
              </div>
              <div className="flex gap-4 mt-1.5">
                {riskData.map((r) => (
                  <span key={r.name} className="text-[11px] text-gray-500">{r.name} {r.pct.toFixed(0)}%</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== 多币种总览 ===== */}
      <div className="grid grid-cols-2 gap-4">
        <CurrencyBreakdownCard
          title="资产币种拆分"
          baseCurrency={baseCurrency}
          rows={remoteOverview?.assetsByCurrency ?? []}
          emptyText="暂无资产币种数据"
          tone="asset"
        />
        <CurrencyBreakdownCard
          title="负债币种拆分"
          baseCurrency={baseCurrency}
          rows={remoteOverview?.liabilitiesByCurrency ?? []}
          emptyText="暂无负债币种数据"
          tone="liability"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <TopAccountCard
          title="Top 资产账户"
          baseCurrency={baseCurrency}
          rows={remoteOverview?.topAssets ?? []}
          emptyText="暂无资产账户"
          tone="asset"
        />
        <TopAccountCard
          title="Top 负债账户"
          baseCurrency={baseCurrency}
          rows={remoteOverview?.topLiabilities ?? []}
          emptyText="暂无负债账户"
          tone="liability"
        />
      </div>

      {/* ===== 底部行：财务状态 + 快照表 + 快捷操作 ===== */}
      <div className="grid grid-cols-3 gap-4">
        {/* 财务状态 */}
        <div className={`rounded-xl border p-5 ${status.bg}`}>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">财务状态</p>
          <p className={`text-lg font-bold mt-1 ${status.color}`}>{status.label}</p>
          <p className="text-sm text-gray-500 mt-1">{status.desc}</p>
          <button onClick={() => navigate('/analysis')} className="mt-3 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
            查看完整分析 →
          </button>
        </div>

        {/* 最近快照 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">最近快照</h3>
            <button onClick={handleSnapshot} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">+ 生成快照</button>
          </div>
          {recentSnapshots.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">暂无快照</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-gray-100">
                  <th className="text-left py-2 font-medium">日期</th>
                  <th className="text-right py-2 font-medium">净资产</th>
                </tr>
              </thead>
              <tbody>
                {recentSnapshots.map((s) => (
                  <tr key={s.clientUid} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate('/snapshots')}>
                    <td className="py-2 text-gray-600">{formatDate(s.snapshotDate)}</td>
                    <td className="py-2 text-right font-medium tabular-nums">{formatCurrency(s.netWorth)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 快捷操作 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">快捷操作</h3>
          <div className="space-y-2.5">
            <button onClick={() => navigate('/assets')}
              className="w-full text-left px-3 py-2.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-sm font-medium text-blue-700 transition-colors">
              ✏️ 管理资产账户
            </button>
            <button onClick={handleSnapshot}
              disabled={assets.length === 0 && liabilities.length === 0}
              className="w-full text-left px-3 py-2.5 rounded-lg bg-green-50 hover:bg-green-100 text-sm font-medium text-green-700 transition-colors disabled:opacity-40">
              📸 生成月度快照
            </button>
            <button onClick={() => navigate('/ai')}
              className="w-full text-left px-3 py-2.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-sm font-medium text-purple-700 transition-colors">
              ✨ AI 财务复盘
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CurrencyBreakdownCard({
  title,
  baseCurrency,
  rows,
  emptyText,
  tone,
}: {
  title: string;
  baseCurrency: string;
  rows: V2CurrencyBreakdown[];
  emptyText: string;
  tone: 'asset' | 'liability';
}) {
  const total = rows.reduce((sum, row) => sum + toNumber(row.convertedAmount), 0);
  const accent = tone === 'asset' ? 'bg-green-500' : 'bg-red-500';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        <span className="text-xs text-gray-400">{baseCurrency} 折算</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">{emptyText}</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const converted = toNumber(row.convertedAmount);
            const ratio = total > 0 ? converted / total : 0;
            return (
              <div key={row.currency} className="space-y-1.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{row.currency}</p>
                    <p className="text-xs text-gray-400 tabular-nums">
                      原币 {formatCurrency(row.originalAmount, row.currency)} · 汇率 {toNumber(row.rate).toFixed(4)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900 tabular-nums">{formatCurrency(converted, baseCurrency)}</p>
                    <p className="text-xs text-gray-400">{formatPercent(ratio)}</p>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className={`h-full rounded-full ${accent}`} style={{ width: `${Math.max(ratio * 100, 2)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TopAccountCard({
  title,
  baseCurrency,
  rows,
  emptyText,
  tone,
}: {
  title: string;
  baseCurrency: string;
  rows: V2AccountBreakdown[];
  emptyText: string;
  tone: 'asset' | 'liability';
}) {
  const amountColor = tone === 'asset' ? 'text-green-600' : 'text-red-600';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        <span className="text-xs text-gray-400">按折算金额排序</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">{emptyText}</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-400 border-b border-gray-100">
              <th className="text-left py-2 font-medium">账户</th>
              <th className="text-right py-2 font-medium">原币金额</th>
              <th className="text-right py-2 font-medium">折算金额</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.clientUid} className="border-b border-gray-50 last:border-0">
                <td className="py-2.5 text-gray-700 font-medium">{row.name}</td>
                <td className="py-2.5 text-right text-gray-500 tabular-nums">{formatCurrency(row.originalAmount ?? 0, row.currency)}</td>
                <td className={`py-2.5 text-right font-semibold tabular-nums ${amountColor}`}>{formatCurrency(row.convertedAmount, baseCurrency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function typeLabel(t: string): string {
  const m: Record<string, string> = { cash: '现金', deposit: '存款', fixedIncome: '固定收益', fund: '基金', stock: '股票', commodity: '商品', foreignCurrency: '外币', housingFund: '住房公积金', other: '其他' };
  return m[t] || t;
}
function riskLabel(r: string): string {
  const m: Record<string, string> = { low: '低风险', medium: '中风险', high: '高风险' };
  return m[r] || r;
}
