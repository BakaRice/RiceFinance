// 对应 iOS FinancialSummaryService + RuleAnalysisService

import type { V2AssetResponse, V2LiabilityResponse, V2SnapshotResponse } from '../api/v2-types';

// ===== 分配项 =====
export interface AllocationItem {
  title: string;
  amount: number;
  ratio: number;
}

// ===== 规则洞察 =====
export type InsightLevel = 'positive' | 'warning' | 'info';

export interface RuleInsight {
  id: string;
  title: string;
  message: string;
  level: InsightLevel;
}

// ===== 财务汇总 =====
export interface FinancialSummary {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  previousNetWorth: number | null;
  typeAllocations: AllocationItem[];
  riskAllocations: AllocationItem[];
  liquidityAllocations: AllocationItem[];
  largestAccountName: string | null;
  largestAccountRatio: number;
  netWorthChange: number | null;
  netWorthChangeRate: number | null;
}

// ===== 资产类型映射 (对应 iOS AssetType enum) =====
const TYPE_LABELS: Record<string, string> = {
  cash: '现金',
  deposit: '存款',
  fixedIncome: '固定收益',
  fund: '基金',
  stock: '股票',
  commodity: '商品',
  foreignCurrency: '外币',
  housingFund: '住房公积金',
  other: '其他',
};

const RISK_LABELS: Record<string, string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
};

const LIQUIDITY_LABELS: Record<string, string> = {
  high: '高流动性',
  medium: '中流动性',
  low: '低流动性',
};


function toNum(v: string): number {
  return parseFloat(v) || 0;
}

// ===== FinancialSummaryService.makeSummary =====
export function makeSummary(
  assets: V2AssetResponse[],
  liabilities: V2LiabilityResponse[],
  snapshots: V2SnapshotResponse[] = [],
): FinancialSummary {
  const activeAssets = assets.filter((a) => !a.deletedAt);
  const activeLiabilities = liabilities.filter((l) => !l.deletedAt);

  const totalAssets = activeAssets.reduce((sum, a) => sum + toNum(a.amount), 0);
  const totalLiabilities = activeLiabilities.reduce((sum, l) => sum + toNum(l.amount), 0);
  const netWorth = totalAssets - totalLiabilities;

  const sortedSnapshots = [...snapshots].sort(
    (a, b) => new Date(b.snapshotDate).getTime() - new Date(a.snapshotDate).getTime(),
  );
  const previousNetWorth = sortedSnapshots.length > 0 ? toNum(sortedSnapshots[0].netWorth) : null;

  const netWorthChange = previousNetWorth != null ? netWorth - previousNetWorth : null;
  const netWorthChangeRate =
    previousNetWorth != null && previousNetWorth !== 0 ? (netWorth - previousNetWorth) / previousNetWorth : null;

  const largest = activeAssets.reduce<V2AssetResponse | null>((max, a) =>
    !max || toNum(a.amount) > toNum(max.amount) ? a : max, null);
  const largestRatio = largest ? toNum(largest.amount) / (totalAssets || 1) : 0;

  return {
    totalAssets,
    totalLiabilities,
    netWorth,
    previousNetWorth,
    typeAllocations: makeAllocations(activeAssets, 'type', TYPE_LABELS, totalAssets),
    riskAllocations: makeAllocations(activeAssets, 'risk', RISK_LABELS, totalAssets),
    liquidityAllocations: makeAllocations(activeAssets, 'liquidity', LIQUIDITY_LABELS, totalAssets),
    largestAccountName: largest?.name ?? null,
    largestAccountRatio: largestRatio,
    netWorthChange,
    netWorthChangeRate,
  };
}

function makeAllocations(
  assets: V2AssetResponse[],
  key: 'type' | 'risk' | 'liquidity',
  labels: Record<string, string>,
  total: number,
): AllocationItem[] {
  const groups: Record<string, number> = {};
  for (const a of assets) {
    const k = a[key] || 'other';
    groups[k] = (groups[k] || 0) + toNum(a.amount);
  }
  return Object.entries(groups)
    .filter(([, amount]) => amount > 0)
    .map(([k, amount]) => ({
      title: labels[k] || k,
      amount,
      ratio: total > 0 ? amount / total : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

// ===== RuleAnalysisService.analyze =====
export function analyzeRules(summary: FinancialSummary): RuleInsight[] {
  const insights: RuleInsight[] = [];

  const cashRatio = ratioFor(['现金', '存款'], summary.typeAllocations);
  if (cashRatio > 0.5) {
    insights.push({
      id: 'cash-high',
      title: '现金占比较高',
      message: '现金类资产超过总资产 50%，资金安全垫充足，但可以关注长期收益效率。',
      level: 'info',
    });
  } else if (cashRatio < 0.1 && summary.totalAssets > 0) {
    insights.push({
      id: 'cash-low',
      title: '现金缓冲偏低',
      message: '现金类资产低于总资产 10%，建议确认应急资金是否足够覆盖 3-6 个月开支。',
      level: 'warning',
    });
  }

  const highRiskRatio = ratioFor(['高风险'], summary.riskAllocations);
  if (highRiskRatio > 0.4) {
    insights.push({
      id: 'high-risk',
      title: '高风险资产偏高',
      message: '高风险资产超过 40%，净资产波动可能变大，适合结合风险承受能力复核配置。',
      level: 'warning',
    });
  }

  const lowLiquidityRatio = ratioFor(['低流动性'], summary.liquidityAllocations);
  if (lowLiquidityRatio > 0.35) {
    insights.push({
      id: 'low-liquidity',
      title: '低流动性资产偏高',
      message: '低流动性资产超过 35%，遇到大额支出时可能需要更早规划资金。',
      level: 'warning',
    });
  }

  if (summary.largestAccountName && summary.largestAccountRatio > 0.45) {
    insights.push({
      id: 'concentration',
      title: '账户集中度较高',
      message: `${summary.largestAccountName} 占总资产超过 45%，建议关注单一平台或单一账户风险。`,
      level: 'warning',
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: 'healthy',
      title: '结构暂未发现明显异常',
      message: '当前资产在风险、流动性和账户集中度上较为均衡，可以持续通过月度快照观察变化。',
      level: 'positive',
    });
  }

  return insights;
}

function ratioFor(titles: string[], allocations: AllocationItem[]): number {
  return allocations.filter((a) => titles.includes(a.title)).reduce((sum, a) => sum + a.ratio, 0);
}

// ===== AIAnalysisService.generateReport =====
export interface AIAnalysisReport {
  summary: string;
  highlights: string[];
  risks: string[];
  nextActions: string[];
  disclaimer: string;
}

export function generateAIReport(summary: FinancialSummary, insights: RuleInsight[]): AIAnalysisReport {
  const changeText =
    summary.netWorthChange != null && summary.netWorthChangeRate != null
      ? `较上次快照变化 ${formatCurrencyShort(summary.netWorthChange)}，变化率 ${formatPercentShort(summary.netWorthChangeRate)}。`
      : '暂无历史快照，本次可以作为后续月度复盘的起点。';

  const warnings = insights.filter((i) => i.level === 'warning').map((i) => i.message);

  return {
    summary: `当前净资产为 ${formatCurrencyShort(summary.netWorth)}，总资产 ${formatCurrencyShort(summary.totalAssets)}，总负债 ${formatCurrencyShort(summary.totalLiabilities)}。${changeText}`,
    highlights: [
      '已形成可追踪的资产台账，后续每月更新即可看到净资产趋势。',
      summary.typeAllocations.length > 0
        ? `当前占比最高的资产类型是 ${summary.typeAllocations[0].title}，占 ${formatPercentShort(summary.typeAllocations[0].ratio)}。`
        : '资产结构数据会在录入账户后自动生成。',
    ],
    risks:
      warnings.length === 0
        ? ['暂未发现明显结构性风险，建议继续关注现金储备、账户集中度和高风险资产占比。']
        : warnings,
    nextActions: [
      '本月结束前更新一次各账户金额，并生成新的月度快照。',
      '为主要账户补充平台、风险等级和流动性等级，提升分析准确度。',
      '如果有大额支出计划，先检查现金储备和低流动性资产占比。',
    ],
    disclaimer: '本报告由本地规则生成，仅用于个人财务复盘，不构成投资建议。',
  };
}

function formatCurrencyShort(value: number): string {
  const sym = '¥';
  return `${sym}${value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
}

function formatPercentShort(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
