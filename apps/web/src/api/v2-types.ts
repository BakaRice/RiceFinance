// === Auth ===
export interface V2RegisterRequest { email: string; password: string; displayName?: string; baseCurrency?: string; }
export interface V2LoginRequest { email: string; password: string; }
export interface V2RefreshRequest { refreshToken: string; }
export interface V2LogoutRequest { refreshToken: string; }
export interface V2UserDto { id: string; email: string; displayName?: string; baseCurrency: string; createdAt: string; }
export interface V2AuthResponse { accessToken: string; refreshToken: string; user: V2UserDto; }

// === Assets ===
export interface V2AssetResponse {
  id: string; clientUid: string; name: string; type: string;
  platform?: string; currency: string; amount: string; shareCount?: string;
  risk: string; liquidity: string; note?: string;
  clientUpdatedAt: string; createdAt: string; updatedAt: string;
  deletedAt?: string; version: number;
}
export interface V2CreateAssetRequest {
  clientUid: string; name: string; type: string; platform?: string;
  currency?: string; amount: string; shareCount?: string;
  risk?: string; liquidity?: string; note?: string; clientUpdatedAt: string;
}
export interface V2UpdateAssetRequest {
  name?: string; type?: string; platform?: string; currency?: string;
  amount?: string; shareCount?: string; risk?: string; liquidity?: string;
  note?: string; clientUpdatedAt: string;
}

// === Liabilities ===
export interface V2LiabilityResponse {
  id: string; clientUid: string; name: string; type: string;
  currency: string; amount: string; dueDate?: string; note?: string;
  clientUpdatedAt: string; createdAt: string; updatedAt: string;
  deletedAt?: string; version: number;
}
export interface V2CreateLiabilityRequest {
  clientUid: string; name: string; type: string; currency?: string;
  amount: string; dueDate?: string; note?: string; clientUpdatedAt: string;
}
export interface V2UpdateLiabilityRequest {
  name?: string; type?: string; currency?: string; amount?: string;
  dueDate?: string; note?: string; clientUpdatedAt: string;
}

// === Snapshots ===
export interface V2SnapshotResponse {
  id: string; clientUid: string; snapshotDate: string;
  totalAssets: string; totalLiabilities: string; netWorth: string;
  currency: string; note?: string; clientUpdatedAt: string;
  createdAt: string; version: number; items?: V2SnapshotItemResponse[];
}
export interface V2SnapshotItemResponse {
  id: string; clientUid: string; sourceName: string; amount: string;
  category?: string; risk?: string; liquidity?: string; isLiability: boolean;
}
export interface V2CreateSnapshotRequest {
  clientUid: string; snapshotDate: string; note?: string; currency?: string;
}

// === Stats ===
export interface V2CurrencyBreakdown { currency: string; originalAmount: string; convertedAmount?: string; rate?: string; }
export interface V2AccountBreakdown { clientUid: string; name: string; currency: string; originalAmount: string; convertedAmount: string; }
export interface V2OverviewResponse {
  baseCurrency: string; totalAssets: string; totalLiabilities: string; netWorth: string;
  assetsByCurrency: V2CurrencyBreakdown[]; liabilitiesByCurrency: V2CurrencyBreakdown[];
  topAssets: V2AccountBreakdown[]; topLiabilities: V2AccountBreakdown[];
}

// === Reports/AI ===
export interface V2ReportResponse {
  id: string; clientUid: string; title: string; reportType: string;
  markdown: string; summaryJson?: any; generatedAt: string;
}
export interface V2AIReviewResponse {
  clientUid: string; summary: string; highlights: string[];
  risks: string[]; nextActions: string[]; disclaimer: string;
  model: string; generatedAt: string;
}

// === Error ===
export interface V2ApiError { error: { code: string; message: string; details?: any[]; }; }

// === Enum Constants (UI dropdowns) ===
export const ASSET_TYPES = [
  { value: 'cash', label: '现金' },
  { value: 'deposit', label: '存款' },
  { value: 'fixedIncome', label: '固收' },
  { value: 'fund', label: '基金' },
  { value: 'stock', label: '股票' },
  { value: 'commodity', label: '大宗商品' },
  { value: 'foreignCurrency', label: '外汇' },
  { value: 'housingFund', label: '公积金' },
  { value: 'other', label: '其他' },
] as const;

export const LIABILITY_TYPES = [
  { value: 'creditCard', label: '信用卡' },
  { value: 'mortgage', label: '房贷' },
  { value: 'consumerLoan', label: '消费贷' },
  { value: 'personalLoan', label: '个人贷款' },
  { value: 'other', label: '其他' },
] as const;

export const RISK_LEVELS = [
  { value: 'low', label: '低风险' },
  { value: 'medium', label: '中风险' },
  { value: 'high', label: '高风险' },
] as const;

export const LIQUIDITY_LEVELS = [
  { value: 'high', label: '高流动性' },
  { value: 'medium', label: '中流动性' },
  { value: 'low', label: '低流动性' },
] as const;

export const CURRENCIES = [
  { value: 'CNY', label: 'CNY 人民币' },
  { value: 'USD', label: 'USD 美元' },
  { value: 'HKD', label: 'HKD 港币' },
  { value: 'EUR', label: 'EUR 欧元' },
] as const;
