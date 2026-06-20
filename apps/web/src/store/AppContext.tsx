import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { finance, snapshots as snapshotsApi } from '../api/v2-client';
import type {
  V2AssetResponse,
  V2LiabilityResponse,
  V2SnapshotResponse,
  V2CreateAssetRequest,
  V2UpdateAssetRequest,
  V2CreateLiabilityRequest,
  V2UpdateLiabilityRequest,
  V2CreateSnapshotRequest,
} from '../api/v2-types';

interface AppState {
  assets: V2AssetResponse[];
  liabilities: V2LiabilityResponse[];
  snapshots: V2SnapshotResponse[];
  loading: boolean;
  error: string | null;
}

interface AppContextType extends AppState {
  refresh: () => Promise<void>;
  addAsset: (data: V2CreateAssetRequest) => Promise<V2AssetResponse>;
  updateAsset: (id: string, data: V2UpdateAssetRequest) => Promise<void>;
  removeAsset: (id: string) => Promise<void>;
  addLiability: (data: V2CreateLiabilityRequest) => Promise<V2LiabilityResponse>;
  updateLiability: (id: string, data: V2UpdateLiabilityRequest) => Promise<void>;
  removeLiability: (id: string) => Promise<void>;
  addSnapshot: (data: V2CreateSnapshotRequest) => Promise<V2SnapshotResponse>;
}

const AppContext = createContext<AppContextType | null>(null);

// 生成客户端 UUID
export function genClientUid(): string {
  return `web-${crypto.randomUUID()}`;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    assets: [],
    liabilities: [],
    snapshots: [],
    loading: false,
    error: null,
  });

  // 过滤已删除的项目
  const activeAssets = state.assets.filter((a) => !a.deletedAt);
  const activeLiabilities = state.liabilities.filter((l) => !l.deletedAt);

  // ===== 从后端拉取全量数据 =====
  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [assets, liabilities, snapshots] = await Promise.all([
        finance.listAssets(),
        finance.listLiabilities(),
        snapshotsApi.list(),
      ]);
      setState({
        assets: assets ?? [],
        liabilities: liabilities ?? [],
        snapshots: snapshots ?? [],
        loading: false,
        error: null,
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: (err as Error).message,
      }));
    }
  }, []);

  // 自动拉取（首次挂载时）
  useEffect(() => {
    refresh();
  }, []);

  // ===== Asset operations =====
  const addAsset = useCallback(async (data: V2CreateAssetRequest): Promise<V2AssetResponse> => {
    const created = await finance.createAsset(data);
    setState((s) => ({ ...s, assets: [...s.assets, created] }));
    return created;
  }, []);

  const updateAsset = useCallback(async (id: string, data: V2UpdateAssetRequest): Promise<void> => {
    const updated = await finance.updateAsset(id, data);
    setState((s) => ({
      ...s,
      assets: s.assets.map((a) => (a.id === id || a.clientUid === id ? updated : a)),
    }));
  }, []);

  const removeAsset = useCallback(async (id: string): Promise<void> => {
    await finance.deleteAsset(id);
    setState((s) => ({
      ...s,
      assets: s.assets.filter((a) => a.id !== id && a.clientUid !== id),
    }));
  }, []);

  // ===== Liability operations =====
  const addLiability = useCallback(async (data: V2CreateLiabilityRequest): Promise<V2LiabilityResponse> => {
    const created = await finance.createLiability(data);
    setState((s) => ({ ...s, liabilities: [...s.liabilities, created] }));
    return created;
  }, []);

  const updateLiability = useCallback(async (id: string, data: V2UpdateLiabilityRequest): Promise<void> => {
    const updated = await finance.updateLiability(id, data);
    setState((s) => ({
      ...s,
      liabilities: s.liabilities.map((l) => (l.id === id || l.clientUid === id ? updated : l)),
    }));
  }, []);

  const removeLiability = useCallback(async (id: string): Promise<void> => {
    await finance.deleteLiability(id);
    setState((s) => ({
      ...s,
      liabilities: s.liabilities.filter((l) => l.id !== id && l.clientUid !== id),
    }));
  }, []);

  // ===== Snapshot operations =====
  const addSnapshot = useCallback(async (data: V2CreateSnapshotRequest): Promise<V2SnapshotResponse> => {
    const created = await snapshotsApi.create(data);
    setState((s) => ({ ...s, snapshots: [...s.snapshots, created] }));
    return created;
  }, []);

  return (
    <AppContext.Provider
      value={{
        assets: activeAssets,
        liabilities: activeLiabilities,
        snapshots: state.snapshots,
        loading: state.loading,
        error: state.error,
        refresh,
        addAsset,
        updateAsset,
        removeAsset,
        addLiability,
        updateLiability,
        removeLiability,
        addSnapshot,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
