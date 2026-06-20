import { useMemo, useState } from 'react';
import { useAppContext } from '../store/AppContext';
import { ASSET_TYPES, RISK_LEVELS, LIQUIDITY_LEVELS } from '../api/v2-types';

const assetTypeLabels = Object.fromEntries(ASSET_TYPES.map((item) => [item.value, item.label]));
const riskLabels = Object.fromEntries(RISK_LEVELS.map((item) => [item.value, item.label]));
const liquidityLabels = Object.fromEntries(LIQUIDITY_LEVELS.map((item) => [item.value, item.label]));

export default function AssetJsonPage() {
  const { assets, loading, refresh } = useAppContext();
  const [copied, setCopied] = useState(false);

  const activeAssets = useMemo(() => assets.filter((asset) => !asset.deletedAt), [assets]);
  const payload = useMemo(() => {
    const totalByCurrency = activeAssets.reduce<Record<string, string>>((acc, asset) => {
      const next = (Number(acc[asset.currency] || 0) + Number(asset.amount || 0)).toString();
      acc[asset.currency] = next;
      return acc;
    }, {});

    return {
      generatedAt: new Date().toISOString(),
      assetCount: activeAssets.length,
      totalByCurrency,
      assets: activeAssets.map((asset) => ({
        clientUid: asset.clientUid,
        name: asset.name,
        type: asset.type,
        typeLabel: assetTypeLabels[asset.type] || asset.type,
        platform: asset.platform,
        currency: asset.currency,
        amount: asset.amount,
        shareCount: asset.shareCount,
        risk: asset.risk,
        riskLabel: riskLabels[asset.risk] || asset.risk,
        liquidity: asset.liquidity,
        liquidityLabel: liquidityLabels[asset.liquidity] || asset.liquidity,
        note: asset.note,
        clientUpdatedAt: asset.clientUpdatedAt,
        version: asset.version,
      })),
    };
  }, [activeAssets]);

  const jsonText = useMemo(() => JSON.stringify(payload, null, 2), [payload]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(jsonText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Asset JSON</p>
            <h3 className="text-lg font-semibold text-gray-900">资产 JSON</h3>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="rounded-md bg-gray-100 px-2 py-1">{activeAssets.length} 项资产</span>
            <span className="rounded-md bg-gray-100 px-2 py-1">{Object.keys(payload.totalByCurrency).length} 个币种</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-gray-300 hover:text-gray-900 disabled:opacity-60"
          >
            {loading ? '刷新中...' : '刷新'}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700"
          >
            {copied ? '已复制' : '复制 JSON'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-4">
        {Object.entries(payload.totalByCurrency).map(([currency, amount]) => (
          <div key={currency} className="rounded-lg border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-gray-400">{currency}</p>
            <p className="mt-1 text-lg font-semibold text-gray-900 tabular-nums">{amount}</p>
          </div>
        ))}
        {Object.keys(payload.totalByCurrency).length === 0 && (
          <div className="col-span-4 rounded-lg border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-400">
            暂无资产数据
          </div>
        )}
      </div>

      <pre className="max-h-[calc(100vh-260px)] overflow-auto rounded-xl border border-gray-200 bg-gray-950 p-5 text-xs leading-relaxed text-gray-100 shadow-sm">
        <code>{jsonText}</code>
      </pre>
    </div>
  );
}
