// 对应 iOS CurrencyFormatter / PercentFormatter

const CURRENCY_SYMBOLS: Record<string, string> = {
  CNY: '¥',
  USD: '$',
  HKD: 'HK$',
  EUR: '€',
};

export function formatCurrency(value: string | number | null | undefined, currency = 'CNY'): string {
  const n = typeof value === 'string' ? parseFloat(value) : (typeof value === 'number' ? value : 0);
  if (isNaN(n) || !isFinite(n)) return `${CURRENCY_SYMBOLS[currency] || currency}0`;
  const sym = CURRENCY_SYMBOLS[currency] || currency;
  return `${sym}${n.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
