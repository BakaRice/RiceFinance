// PC 结构分析 — 三列布局 + 图表 + 规则洞察
import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell } from 'recharts';
import { useAppContext } from '../store/AppContext';
import { makeSummary, analyzeRules } from '../lib/summary';
import { formatCurrency, formatPercent } from '../lib/formatters';
import type { AllocationItem } from '../lib/summary';

const TINT_COLORS: Record<string, string> = { type: '#3B82F6', risk: '#F97316', liquidity: '#00C7BE' };

const INSIGHT_META: Record<string, { icon: string; bg: string; border: string }> = {
  positive: { icon: '✅', bg: 'bg-green-50', border: 'border-green-200' },
  warning: { icon: '⚠️', bg: 'bg-orange-50', border: 'border-orange-200' },
  info: { icon: 'ℹ️', bg: 'bg-blue-50', border: 'border-blue-200' },
};

export default function AnalysisPage() {
  const { assets, liabilities, snapshots } = useAppContext();
  const summary = useMemo(() => makeSummary(assets, liabilities, snapshots), [assets, liabilities, snapshots]);
  const insights = useMemo(() => analyzeRules(summary), [summary]);

  const sections: { key: string; title: string; subtitle: string; items: AllocationItem[] }[] = [
    { key: 'type', title: '资产类型', subtitle: '按资产类别分布', items: summary.typeAllocations },
    { key: 'risk', title: '风险等级', subtitle: '按风险偏好分布', items: summary.riskAllocations },
    { key: 'liquidity', title: '流动性', subtitle: '按变现能力分布', items: summary.liquidityAllocations },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* 三列分配分析 */}
      <div className="grid grid-cols-3 gap-4">
        {sections.map(({ key, title, subtitle, items }) => (
          <div key={key} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
              <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
            </div>
            <div className="p-5">
              {items.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">暂无数据</p>
              ) : (
                <>
                  {/* 条形图 */}
                  <div className="h-36 mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={items.map((i) => ({ name: i.title, value: i.amount, pct: i.ratio * 100 }))} layout="vertical" margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14}>
                          {items.map((_, i) => (<Cell key={i} fill={TINT_COLORS[key]} />))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  {/* 列表 */}
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div key={item.title} className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">{item.title}</span>
                        <span className="text-gray-400 tabular-nums">{formatCurrency(item.amount)}</span>
                        <span className="text-gray-900 font-medium tabular-nums w-14 text-right">{formatPercent(item.ratio)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 汇总指标 */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: '总资产', value: formatCurrency(summary.totalAssets), color: 'text-green-600' },
          { label: '总负债', value: formatCurrency(summary.totalLiabilities), color: 'text-red-600' },
          { label: '净资产', value: formatCurrency(summary.netWorth), color: 'text-gray-900' },
          { label: '资产账户数', value: `${assets.filter((a) => !a.deletedAt).length}`, color: 'text-gray-700' },
          { label: '负债账户数', value: `${liabilities.filter((l) => !l.deletedAt).length}`, color: 'text-gray-700' },
        ].map((m) => (
          <div key={m.label} className="bg-white rounded-xl border border-gray-200 px-4 py-3 text-center">
            <p className="text-xs text-gray-400">{m.label}</p>
            <p className={`text-base font-bold mt-1 tabular-nums ${m.color}`}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* 规则洞察 */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">规则洞察</h3>
        <div className="grid grid-cols-2 gap-3">
          {insights.map((insight) => {
            const meta = INSIGHT_META[insight.level];
            return (
              <div key={insight.id} className={`rounded-xl border p-4 ${meta.bg} ${meta.border}`}>
                <div className="flex items-start gap-3">
                  <span className="text-lg shrink-0">{meta.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{insight.title}</p>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{insight.message}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
