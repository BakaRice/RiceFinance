import SwiftData
import SwiftUI
import UniformTypeIdentifiers

struct AssetListView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \AssetAccount.updatedAt, order: .reverse) private var assets: [AssetAccount]
    @Query(sort: \LiabilityAccount.updatedAt, order: .reverse) private var liabilities: [LiabilityAccount]
    @Query(sort: \NetWorthSnapshot.date, order: .reverse) private var snapshots: [NetWorthSnapshot]
    @State private var showingAssetForm = false
    @State private var showingLiabilityForm = false
    @State private var showingImporter = false
    @State private var showingExporter = false
    @State private var exportDocument = RiceFinanceExportDocument()
    @State private var statusMessage: String?
    @State private var showingStatus = false

    var body: some View {
        NavigationStack {
            List {
                Section("资产账户") {
                    if assets.isEmpty {
                        ContentUnavailableView("暂无资产账户", systemImage: "wallet.pass")
                    } else {
                        ForEach(assets) { asset in
                            NavigationLink {
                                AssetFormView(asset: asset)
                            } label: {
                                AssetRow(asset: asset)
                            }
                        }
                        .onDelete(perform: deleteAssets)
                    }
                }

                Section("负债账户") {
                    if liabilities.isEmpty {
                        ContentUnavailableView("暂无负债账户", systemImage: "creditcard")
                    } else {
                        ForEach(liabilities) { liability in
                            NavigationLink {
                                LiabilityFormView(liability: liability)
                            } label: {
                                LiabilityRow(liability: liability)
                            }
                        }
                        .onDelete(perform: deleteLiabilities)
                    }
                }
            }
            .navigationTitle("资产")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Menu {
                        Section("测试数据") {
                            ForEach(TestDataPreset.allCases) { preset in
                                Button {
                                    generateTestData(preset)
                                } label: {
                                    Label(preset.title, systemImage: preset.systemImage)
                                }
                            }
                        }

                        Section("数据文件") {
                            Button {
                                showingImporter = true
                            } label: {
                                Label("导入 JSON", systemImage: "square.and.arrow.down")
                            }

                            Button {
                                exportCurrentData()
                            } label: {
                                Label("导出 JSON", systemImage: "square.and.arrow.up")
                            }
                        }
                    } label: {
                        Label("数据工具", systemImage: "wand.and.stars")
                    }
                }

                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button {
                        showingLiabilityForm = true
                    } label: {
                        Label("新增负债", systemImage: "minus.circle")
                    }

                    Button {
                        showingAssetForm = true
                    } label: {
                        Label("新增资产", systemImage: "plus.circle")
                    }
                }
            }
            .sheet(isPresented: $showingAssetForm) {
                NavigationStack {
                    AssetFormView()
                }
            }
            .sheet(isPresented: $showingLiabilityForm) {
                NavigationStack {
                    LiabilityFormView()
                }
            }
            .fileImporter(isPresented: $showingImporter, allowedContentTypes: [.json]) { result in
                importFile(result)
            }
            .fileExporter(
                isPresented: $showingExporter,
                document: exportDocument,
                contentType: .json,
                defaultFilename: defaultExportFilename
            ) { result in
                handleExportResult(result)
            }
            .alert(statusMessage ?? "", isPresented: $showingStatus) {
                Button("好", role: .cancel) {}
            }
        }
    }

    private func deleteAssets(at offsets: IndexSet) {
        do {
            for asset in offsets.map({ assets[$0] }) {
                try VaultSyncService.deleteAsset(asset)
                modelContext.delete(asset)
            }
        } catch {
            showStatus("删除资产失败：\(error.localizedDescription)")
        }
    }

    private func deleteLiabilities(at offsets: IndexSet) {
        do {
            for liability in offsets.map({ liabilities[$0] }) {
                try VaultSyncService.deleteLiability(liability)
                modelContext.delete(liability)
            }
        } catch {
            showStatus("删除负债失败：\(error.localizedDescription)")
        }
    }

    private var defaultExportFilename: String {
        "RiceFinance-\(Date.now.formatted(.iso8601.year().month().day()))"
    }

    private func exportCurrentData() {
        do {
            let data = try ImportExportService.makeExportData(
                assets: assets,
                liabilities: liabilities,
                snapshots: snapshots
            )
            exportDocument = RiceFinanceExportDocument(data: data)
            showingExporter = true
        } catch {
            showStatus("导出失败：\(error.localizedDescription)")
        }
    }

    private func generateTestData(_ preset: TestDataPreset) {
        do {
            let result = try TestDataService.generate(
                preset: preset,
                existingAssets: assets,
                existingLiabilities: liabilities,
                into: modelContext
            )
            showStatus("已生成测试数据并写入 \(ICloudVaultService.locationDescription)：资产 \(result.assetCount) 条，负债 \(result.liabilityCount) 条，快照 \(result.snapshotCount) 条。")
        } catch {
            showStatus("生成测试数据失败：\(error.localizedDescription)")
        }
    }

    private func importFile(_ result: Result<URL, Error>) {
        do {
            let url = try result.get()
            let didAccess = url.startAccessingSecurityScopedResource()
            defer {
                if didAccess {
                    url.stopAccessingSecurityScopedResource()
                }
            }

            let data = try Data(contentsOf: url)
            let importResult = try ImportExportService.importData(data, into: modelContext)
            try VaultSyncService.writeCachedData(from: modelContext)
            showStatus("""
            导入完成，并已写入 \(ICloudVaultService.locationDescription)：资产 \(importResult.assetCount) 条，负债 \(importResult.liabilityCount) 条，快照 \(importResult.snapshotCount) 条。
            新增：资产 \(importResult.insertedAssetCount)，负债 \(importResult.insertedLiabilityCount)，快照 \(importResult.insertedSnapshotCount)。
            更新：资产 \(importResult.updatedAssetCount)，负债 \(importResult.updatedLiabilityCount)，快照 \(importResult.updatedSnapshotCount)。
            """)
        } catch {
            showStatus("导入失败：\(error.localizedDescription)")
        }
    }

    private func handleExportResult(_ result: Result<URL, Error>) {
        switch result {
        case .success:
            showStatus("导出完成。")
        case .failure(let error):
            showStatus("导出失败：\(error.localizedDescription)")
        }
    }

    private func showStatus(_ message: String) {
        statusMessage = message
        showingStatus = true
    }
}

private struct AssetRow: View {
    let asset: AssetAccount

    var body: some View {
        Label {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(asset.name)
                        .font(.headline)
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                Spacer()
                Text(CurrencyFormatter.short(asset.amount, currency: asset.currency))
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
            }
        } icon: {
            Image(systemName: asset.type.symbol)
                .foregroundStyle(asset.type.color)
        }
    }

    private var subtitle: String {
        var parts = [asset.type.title]
        if let shareCount = asset.shareCount {
            parts.append("份额 \(NSDecimalNumber(decimal: shareCount).stringValue)")
        }
        if !asset.platform.isEmpty {
            parts.append(asset.platform)
        }
        if asset.currency != .cny {
            parts.append(asset.currency.title)
        }
        return parts.joined(separator: " · ")
    }
}

private struct LiabilityRow: View {
    let liability: LiabilityAccount

    var body: some View {
        Label {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(liability.name)
                        .font(.headline)
                    Text(liability.type.title)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Text(CurrencyFormatter.short(liability.amount, currency: liability.currency))
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.red)
            }
        } icon: {
            Image(systemName: "creditcard")
                .foregroundStyle(.red)
        }
    }
}
