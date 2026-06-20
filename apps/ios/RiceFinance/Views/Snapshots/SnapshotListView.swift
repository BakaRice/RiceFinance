import SwiftData
import SwiftUI

struct SnapshotListView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \AssetAccount.updatedAt, order: .reverse) private var assets: [AssetAccount]
    @Query(sort: \LiabilityAccount.updatedAt, order: .reverse) private var liabilities: [LiabilityAccount]
    @Query(sort: \NetWorthSnapshot.date, order: .reverse) private var snapshots: [NetWorthSnapshot]
    @State private var statusMessage: String?
    @State private var showingStatus = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Button {
                        createSnapshot()
                    } label: {
                        Label("生成本月快照", systemImage: "camera")
                    }
                    .disabled(assets.isEmpty && liabilities.isEmpty)
                }

                Section("历史快照") {
                    if snapshots.isEmpty {
                        ContentUnavailableView("暂无快照", systemImage: "calendar.badge.clock", description: Text("生成一次快照后可追踪净资产变化。"))
                    } else {
                        ForEach(snapshots) { snapshot in
                            NavigationLink {
                                SnapshotDetailView(snapshot: snapshot)
                            } label: {
                                SnapshotRow(snapshot: snapshot)
                            }
                        }
                        .onDelete(perform: deleteSnapshots)
                    }
                }
            }
            .navigationTitle("快照")
            .alert(statusMessage ?? "", isPresented: $showingStatus) {
                Button("好", role: .cancel) {}
            }
        }
    }

    private func deleteSnapshots(at offsets: IndexSet) {
        do {
            for snapshot in offsets.map({ snapshots[$0] }) {
                try VaultSyncService.deleteSnapshot(snapshot)
                modelContext.delete(snapshot)
            }
        } catch {
            showStatus("删除快照失败：\(error.localizedDescription)")
        }
    }

    private func createSnapshot() {
        do {
            let snapshot = SnapshotService.createSnapshot(assets: assets, liabilities: liabilities, context: modelContext)
            try VaultSyncService.write(snapshot)
            showStatus("快照已保存到 \(ICloudVaultService.locationDescription)。")
        } catch {
            showStatus("保存快照失败：\(error.localizedDescription)")
        }
    }

    private func showStatus(_ message: String) {
        statusMessage = message
        showingStatus = true
    }
}

private struct SnapshotRow: View {
    let snapshot: NetWorthSnapshot

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(snapshot.date.formatted(date: .abbreviated, time: .shortened))
                .font(.headline)
            Text("净资产 \(CurrencyFormatter.short(snapshot.netWorth)) · 资产 \(CurrencyFormatter.short(snapshot.totalAssets)) · 负债 \(CurrencyFormatter.short(snapshot.totalLiabilities))")
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
    }
}
