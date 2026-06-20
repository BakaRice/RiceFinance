// PC AI 复盘 — 文档式横向布局
import { useEffect, useMemo, useState } from 'react';
import { ai } from '../api/v2-client';
import { useAppContext } from '../store/AppContext';
import { makeSummary, analyzeRules } from '../lib/summary';
import { formatCurrency } from '../lib/formatters';
import type { V2AIReviewResponse } from '../api/v2-types';

export default function AIPage() {
  const { assets, liabilities, snapshots } = useAppContext();
  const [report, setReport] = useState<V2AIReviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const summary = useMemo(() => makeSummary(assets, liabilities, snapshots), [assets, liabilities, snapshots]);
  const insights = useMemo(() => analyzeRules(summary), [summary]);

  const loadReview = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await ai.latestReview();
      if (result && result.summaryJson) {
        // summaryJson may contain structured review data
        setReport(result.summaryJson as V2AIReviewResponse);
      } else {
        setReport(null);
      }
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : 'AI 复盘读取失败');
    } finally {
      setLoading(false);
    }
  };

  const generateReview = async () => {
    setLoading(true);
    setError(null);
    try {
      const nextReport = await ai.generateReview();
      setReport(nextReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 复盘生成失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (assets.length > 0 || liabilities.length > 0) {
      void loadReview();
    }
  }, [assets.length, liabilities.length]);

  if (assets.length === 0 && liabilities.length === 0) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <p className="text-4xl mb-4">✨</p>
        <p className="text-gray-400">录入资产并生成快照后，AI 复盘将自动生成</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* 报告头部 */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-8 mb-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-indigo-200 text-xs font-medium uppercase tracking-wider mb-2">Monthly Financial Review</p>
            <h2 className="text-2xl font-bold">月度财务复盘报告</h2>
            <p className="text-indigo-200 text-sm mt-2">
              {(report?.generatedAt ? new Date(report.generatedAt) : new Date()).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })} 生成
              {report?.model ? ` · ${report.model}` : ''}
            </p>
          </div>
          <div className="text-right">
            <p className="text-indigo-200 text-xs">净资产</p>
            <p className="text-3xl font-bold tracking-tight">{formatCurrency(summary.netWorth)}</p>
            <button
              type="button"
              onClick={generateReview}
              disabled={loading}
              className="mt-3 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/25 disabled:opacity-60"
            >
              {loading ? '处理中...' : report ? '重新生成' : '生成复盘'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 三列指标 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: '总资产', value: formatCurrency(summary.totalAssets), color: 'text-green-600', bg: 'bg-green-50' },
          { label: '总负债', value: formatCurrency(summary.totalLiabilities), color: 'text-red-600', bg: 'bg-red-50' },
          { label: '资产账户', value: `${assets.filter((a) => !a.deletedAt).length} 个`, color: 'text-gray-700', bg: 'bg-gray-50' },
        ].map((m) => (
          <div key={m.label} className={`${m.bg} rounded-xl p-4 text-center`}>
            <p className="text-xs text-gray-500 mb-1">{m.label}</p>
            <p className={`text-xl font-bold tabular-nums ${m.color}`}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* 报告正文 — 两列布局 */}
      <div className="grid grid-cols-5 gap-6">
        {/* 左侧：亮点 + 风险 - 占3列 */}
        <div className="col-span-3 space-y-5">
          {/* 财务状态总结 */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">财务状态总结</h3>
            <p className="text-sm text-gray-700 leading-relaxed">
              {loading && !report ? '正在读取已保存的 AI 复盘...' : report?.summary || '暂无 AI 复盘内容，点击右上角生成复盘。'}
            </p>
          </section>

          {/* 亮点 */}
          <section className="bg-white rounded-xl border border-green-200 p-6">
            <h3 className="text-sm font-semibold text-green-600 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" /> 当前亮点
            </h3>
            <ul className="space-y-3">
              {(report?.highlights || []).map((h, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="text-green-500 font-bold mt-0.5 shrink-0">✓</span>
                  <span className="text-gray-700 leading-relaxed">{h}</span>
                </li>
              ))}
              {!loading && report && report.highlights.length === 0 && (
                <li className="text-sm text-gray-500">本次未返回明确亮点。</li>
              )}
            </ul>
          </section>

          {/* 风险 */}
          <section className="bg-white rounded-xl border border-orange-200 p-6">
            <h3 className="text-sm font-semibold text-orange-600 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-500" /> 潜在风险
            </h3>
            <ul className="space-y-3">
              {(report?.risks || []).map((r, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="text-orange-500 font-bold mt-0.5 shrink-0">!</span>
                  <span className="text-gray-700 leading-relaxed">{r}</span>
                </li>
              ))}
              {!loading && report && report.risks.length === 0 && (
                <li className="text-sm text-gray-500">本次未返回明确风险。</li>
              )}
            </ul>
          </section>
        </div>

        {/* 右侧：建议 - 占2列 */}
        <div className="col-span-2">
          <section className="bg-white rounded-xl border border-blue-200 p-6 sticky top-24">
            <h3 className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" /> 下月建议
            </h3>
            <ul className="space-y-4">
              {(report?.nextActions || []).map((a, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="text-blue-500 font-bold mt-0.5 shrink-0">{i + 1}.</span>
                  <span className="text-gray-700 leading-relaxed">{a}</span>
                </li>
              ))}
              {!loading && report && report.nextActions.length === 0 && (
                <li className="text-sm text-gray-500">本次未返回行动建议。</li>
              )}
            </ul>

            <hr className="my-5 border-gray-100" />

            {/* 规则洞察摘要 */}
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">规则检测</h4>
            <div className="space-y-2">
              {insights.map((insight) => (
                <div key={insight.id} className="flex items-start gap-2">
                  <span className={`text-xs mt-0.5 shrink-0 ${insight.level === 'warning' ? 'text-orange-500' : insight.level === 'positive' ? 'text-green-500' : 'text-blue-500'}`}>
                    {insight.level === 'warning' ? '⚠' : insight.level === 'positive' ? '✓' : 'ℹ'}
                  </span>
                  <span className="text-xs text-gray-600">{insight.title}</span>
                </div>
              ))}
            </div>

            <hr className="my-5 border-gray-100" />
            <p className="text-[11px] text-gray-400 leading-relaxed">
              {report?.disclaimer || 'AI 复盘仅用于个人财务整理和回顾，不构成投资建议。'}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
