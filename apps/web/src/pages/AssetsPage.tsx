// PC 资产管理 — 数据表格 + 侧边面板表单 + Tab切换
import { useState } from 'react';
import { useAppContext, genClientUid } from '../store/AppContext';
import { formatCurrency } from '../lib/formatters';
import { ASSET_TYPES, LIABILITY_TYPES, RISK_LEVELS, LIQUIDITY_LEVELS, CURRENCIES } from '../api/v2-types';
import type { V2AssetResponse, V2LiabilityResponse } from '../api/v2-types';

const now = () => new Date().toISOString();

type FormData =
  | { kind: 'asset'; data?: V2AssetResponse }
  | { kind: 'liability'; data?: V2LiabilityResponse }
  | null;

export default function AssetsPage() {
  const { assets, liabilities, addAsset, updateAsset, removeAsset, addLiability, updateLiability, removeLiability, refresh } = useAppContext();
  const [tab, setTab] = useState<'assets' | 'liabilities'>('assets');
  const [panel, setPanel] = useState<FormData>(null);

  const activeAssets = assets.filter((a) => !a.deletedAt);
  const activeLiabilities = liabilities.filter((l) => !l.deletedAt);

  const totalAssets = activeAssets.reduce((s, a) => s + parseFloat(a.amount), 0);
  const totalLiabilities = activeLiabilities.reduce((s, l) => s + parseFloat(l.amount), 0);

  const handleDelete = () => {
    if (!panel?.data) return;
    if (panel.kind === 'asset') removeAsset(panel.data.id);
    else removeLiability(panel.data.id);
    setPanel(null);
  };

  const handleSave = async (form: Record<string, string>) => {
    if (!panel) return;
    const ts = now();

    if (panel.kind === 'asset') {
      if (panel.data) {
        await updateAsset(panel.data.id, {
          name: form.name,
          type: form.type,
          currency: form.currency,
          amount: form.amount,
          platform: form.platform || undefined,
          shareCount: form.shareCount || undefined,
          risk: form.risk,
          liquidity: form.liquidity,
          note: form.note || undefined,
          clientUpdatedAt: ts,
        });
      } else {
        await addAsset({
          clientUid: genClientUid(),
          name: form.name,
          type: form.type,
          currency: form.currency,
          amount: form.amount,
          platform: form.platform || undefined,
          shareCount: form.shareCount || undefined,
          risk: form.risk || 'medium',
          liquidity: form.liquidity || 'medium',
          note: form.note || undefined,
          clientUpdatedAt: ts,
        });
      }
    } else {
      if (panel.data) {
        await updateLiability(panel.data.id, {
          name: form.name,
          type: form.type,
          currency: form.currency,
          amount: form.amount,
          dueDate: form.dueDate || undefined,
          note: form.note || undefined,
          clientUpdatedAt: ts,
        });
      } else {
        await addLiability({
          clientUid: genClientUid(),
          name: form.name,
          type: form.type,
          currency: form.currency,
          amount: form.amount,
          dueDate: form.dueDate || undefined,
          note: form.note || undefined,
          clientUpdatedAt: ts,
        });
      }
    }
    setPanel(null);
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setTab('assets')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === 'assets' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            资产账户 <span className="ml-1 text-xs text-gray-400">({activeAssets.length})</span>
          </button>
          <button
            onClick={() => setTab('liabilities')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === 'liabilities' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            负债账户 <span className="ml-1 text-xs text-gray-400">({activeLiabilities.length})</span>
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={refresh} className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
            刷新数据
          </button>
          {tab === 'assets' ? (
            <button onClick={() => setPanel({ kind: 'asset' })} className="bg-indigo-600 text-white text-sm font-medium px-4 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors">
              + 新增资产
            </button>
          ) : (
            <button onClick={() => setPanel({ kind: 'liability' })} className="bg-red-600 text-white text-sm font-medium px-4 py-1.5 rounded-lg hover:bg-red-700 transition-colors">
              + 新增负债
            </button>
          )}
        </div>
      </div>

      {/* 数据表格 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {tab === 'assets' ? (
          activeAssets.length === 0 ? (
            <EmptyState text="暂无资产账户" action="新增资产" onClick={() => setPanel({ kind: 'asset' })} />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">名称</th>
                  <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">类型</th>
                  <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">平台</th>
                  <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider text-right">金额</th>
                  <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">风险</th>
                  <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">流动性</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeAssets.map((a) => (
                  <tr key={a.id} onClick={() => setPanel({ kind: 'asset', data: a })}
                    className="hover:bg-indigo-50/40 cursor-pointer transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-900">{a.name}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">{typeLabel(a.type)}</span>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{a.platform || '—'}</td>
                    <td className="px-5 py-3 text-right font-medium tabular-nums">{formatCurrency(a.amount, a.currency)}</td>
                    <td className="px-5 py-3">
                      <RiskBadge level={a.risk} />
                    </td>
                    <td className="px-5 py-3">
                      <LiquidityBadge level={a.liquidity} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-medium">
                  <td className="px-5 py-3 text-gray-500">合计 ({activeAssets.length} 项)</td>
                  <td className="px-5 py-3" colSpan={3}></td>
                  <td className="px-5 py-3 text-right font-bold text-gray-900 tabular-nums" colSpan={2}>
                    {formatCurrency(totalAssets)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )
        ) : (
          activeLiabilities.length === 0 ? (
            <EmptyState text="暂无负债账户" action="新增负债" onClick={() => setPanel({ kind: 'liability' })} />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">名称</th>
                  <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">类型</th>
                  <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">到期日</th>
                  <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider text-right">金额</th>
                  <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">币种</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeLiabilities.map((l) => (
                  <tr key={l.id} onClick={() => setPanel({ kind: 'liability', data: l })}
                    className="hover:bg-red-50/30 cursor-pointer transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-900">{l.name}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-red-50 text-red-600">{liabilityLabel(l.type)}</span>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{l.dueDate ? new Date(l.dueDate).toLocaleDateString('zh-CN') : '—'}</td>
                    <td className="px-5 py-3 text-right font-medium text-red-600 tabular-nums">{formatCurrency(l.amount, l.currency)}</td>
                    <td className="px-5 py-3 text-gray-500">{l.currency}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-medium">
                  <td className="px-5 py-3 text-gray-500">合计 ({activeLiabilities.length} 项)</td>
                  <td className="px-5 py-3" colSpan={2}></td>
                  <td className="px-5 py-3 text-right font-bold text-red-600 tabular-nums" colSpan={2}>
                    {formatCurrency(totalLiabilities)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )
        )}
      </div>

      {/* 侧边面板表单 */}
      {panel && (
        <FormPanel
          initial={panel}
          onClose={() => setPanel(null)}
          onDelete={panel.data ? handleDelete : undefined}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

// ===== 居中弹窗表单 =====
function FormPanel({
  initial,
  onClose,
  onDelete,
  onSave,
}: {
  initial: NonNullable<FormData>;
  onClose: () => void;
  onDelete?: () => void;
  onSave: (data: Record<string, string>) => void;
}) {
  const isEdit = !!initial.data;
  const isAsset = initial.kind === 'asset';
  const d = initial.data;
  const [name, setName] = useState(d?.name ?? '');
  const [type, setType] = useState(d?.type ?? (isAsset ? 'cash' : 'creditCard'));
  const [amount, setAmount] = useState(d?.amount ?? '0');
  const [currency, setCurrency] = useState(d?.currency ?? 'CNY');
  const [note, setNote] = useState(d?.note ?? '');
  const [platform, setPlatform] = useState(isAsset ? ((d as V2AssetResponse)?.platform ?? '') : '');
  const [shareCount, setShareCount] = useState(isAsset ? ((d as V2AssetResponse)?.shareCount ?? '') : '');
  const [risk, setRisk] = useState(isAsset ? ((d as V2AssetResponse)?.risk ?? 'medium') : 'low');
  const [liquidity, setLiquidity] = useState(isAsset ? ((d as V2AssetResponse)?.liquidity ?? 'medium') : 'high');
  const [dueDate, setDueDate] = useState(!isAsset ? ((d as V2LiabilityResponse)?.dueDate ?? '') : '');

  const handleSubmit = () => {
    onSave({ name, type, amount, currency, note: note || '', platform, shareCount, risk, liquidity, dueDate });
  };

  return (
    <>
      {/* 遮罩 */}
      <div className="fixed inset-0 bg-black/30 z-40 flex items-center justify-center p-4" onClick={onClose}>
        {/* 居中弹窗 */}
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto z-50" onClick={(e) => e.stopPropagation()}>
          <div className="sticky top-0 bg-white border-b border-gray-200 rounded-t-2xl px-6 py-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">
              {isEdit ? (isAsset ? '编辑资产' : '编辑负债') : (isAsset ? '新增资产' : '新增负债')}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
          </div>

          <div className="px-6 py-5 space-y-4">
          {/* 名称 */}
          <FormField label="名称" required>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              placeholder={isAsset ? '如：招行活期' : '如：招行信用卡'} />
          </FormField>

          {/* 类型 + 币种 并排 */}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="类型">
              <select value={type} onChange={(e) => setType(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                {(isAsset ? ASSET_TYPES : LIABILITY_TYPES).map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
              </select>
            </FormField>
            <FormField label="币种">
              <select value={currency} onChange={(e) => setCurrency(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                {CURRENCIES.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
              </select>
            </FormField>
          </div>

          {/* 金额 */}
          <FormField label="金额" required>
            <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
          </FormField>

          {/* 资产特有：平台 + 份额 */}
          {isAsset && (
            <div className="grid grid-cols-2 gap-3">
              <FormField label="平台">
                <input value={platform} onChange={(e) => setPlatform(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="如：招商银行" />
              </FormField>
              <FormField label="份额">
                <input type="number" step="0.01" value={shareCount} onChange={(e) => setShareCount(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
              </FormField>
            </div>
          )}

          {/* 资产特有：风险 + 流动性 */}
          {isAsset && (
            <div className="grid grid-cols-2 gap-3">
              <FormField label="风险等级">
                <select value={risk} onChange={(e) => setRisk(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                  {RISK_LEVELS.map((r) => (<option key={r.value} value={r.value}>{r.label}</option>))}
                </select>
              </FormField>
              <FormField label="流动性">
                <select value={liquidity} onChange={(e) => setLiquidity(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                  {LIQUIDITY_LEVELS.map((l) => (<option key={l.value} value={l.value}>{l.label}</option>))}
                </select>
              </FormField>
            </div>
          )}

          {/* 负债特有：到期日 */}
          {!isAsset && (
            <FormField label="到期日">
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
            </FormField>
          )}

          {/* 备注 */}
          <FormField label="备注">
            <input value={note} onChange={(e) => setNote(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
          </FormField>

          {/* 操作按钮 */}
          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button onClick={handleSubmit}
              className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
              {isEdit ? '保存修改' : '确认添加'}
            </button>
            {onDelete && (
              <button onClick={onDelete}
                className="px-4 py-2.5 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors">
                删除
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

// ===== 小组件 =====
function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

function RiskBadge({ level }: { level: string }) {
  const m: Record<string, { label: string; cls: string }> = {
    low: { label: '低风险', cls: 'bg-green-50 text-green-700' },
    medium: { label: '中风险', cls: 'bg-yellow-50 text-yellow-700' },
    high: { label: '高风险', cls: 'bg-red-50 text-red-700' },
  };
  const v = m[level] || { label: level, cls: 'bg-gray-50 text-gray-600' };
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs ${v.cls}`}>{v.label}</span>;
}

function LiquidityBadge({ level }: { level: string }) {
  const m: Record<string, { label: string; cls: string }> = {
    high: { label: '高流动性', cls: 'bg-teal-50 text-teal-700' },
    medium: { label: '中流动性', cls: 'bg-blue-50 text-blue-700' },
    low: { label: '低流动性', cls: 'bg-purple-50 text-purple-700' },
  };
  const v = m[level] || { label: level, cls: 'bg-gray-50 text-gray-600' };
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs ${v.cls}`}>{v.label}</span>;
}

function EmptyState({ text, action, onClick }: { text: string; action: string; onClick: () => void }) {
  return (
    <div className="py-16 text-center">
      <p className="text-sm text-gray-400 mb-3">{text}</p>
      <button onClick={onClick} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium border border-indigo-200 rounded-lg px-4 py-2 hover:bg-indigo-50 transition-colors">
        {action}
      </button>
    </div>
  );
}

function typeLabel(t: string): string { return ASSET_TYPES.find((x) => x.value === t)?.label ?? t; }
function liabilityLabel(t: string): string { return LIABILITY_TYPES.find((x) => x.value === t)?.label ?? t; }
