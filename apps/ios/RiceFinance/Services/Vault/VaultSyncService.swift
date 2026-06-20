import Foundation
import SwiftData

@MainActor
enum VaultSyncService {
    @discardableResult
    static func bootstrapCache(from context: ModelContext) throws -> VaultImportResult {
        try ICloudVaultService.ensureVault()
        let result = try importVaultFiles(into: context)

        let assets = try context.fetch(FetchDescriptor<AssetAccount>())
        let liabilities = try context.fetch(FetchDescriptor<LiabilityAccount>())
        let snapshots = try context.fetch(FetchDescriptor<NetWorthSnapshot>())

        try writeAll(assets: assets, liabilities: liabilities, snapshots: snapshots)
        try context.save()
        return result
    }

    static func write(_ asset: AssetAccount) throws {
        try ICloudVaultService.writeJSON(
            VaultRecordCodec.assetRecord(from: asset),
            to: try ICloudVaultService.recordURL(directory: .assets, filename: assetFilename(uid: asset.uid))
        )
    }

    static func write(_ liability: LiabilityAccount) throws {
        try ICloudVaultService.writeJSON(
            VaultRecordCodec.liabilityRecord(from: liability),
            to: try ICloudVaultService.recordURL(directory: .liabilities, filename: liabilityFilename(uid: liability.uid))
        )
    }

    static func write(_ snapshot: NetWorthSnapshot) throws {
        try ICloudVaultService.writeJSON(
            VaultRecordCodec.snapshotRecord(from: snapshot),
            to: try ICloudVaultService.recordURL(directory: .snapshots, filename: snapshotFilename(snapshot))
        )
    }

    static func deleteAsset(_ asset: AssetAccount) throws {
        try ICloudVaultService.removeRecord(directory: .assets, filename: assetFilename(uid: asset.uid))
    }

    static func deleteLiability(_ liability: LiabilityAccount) throws {
        try ICloudVaultService.removeRecord(directory: .liabilities, filename: liabilityFilename(uid: liability.uid))
    }

    static func deleteSnapshot(_ snapshot: NetWorthSnapshot) throws {
        try ICloudVaultService.removeRecord(directory: .snapshots, filename: snapshotFilename(snapshot))
    }

    static func writeCachedData(from context: ModelContext) throws {
        try writeAll(
            assets: try context.fetch(FetchDescriptor<AssetAccount>()),
            liabilities: try context.fetch(FetchDescriptor<LiabilityAccount>()),
            snapshots: try context.fetch(FetchDescriptor<NetWorthSnapshot>())
        )
    }

    static func writeReport(markdown: String, generatedAt: Date = .now) throws {
        let filename = "report-\(generatedAt.formatted(.iso8601.year().month().day()))-\(safeFilenameComponent(UUID().uuidString)).md"
        try ICloudVaultService.writeText(
            markdown,
            to: try ICloudVaultService.recordURL(directory: .reports, filename: filename)
        )
    }

    private static func writeAll(
        assets: [AssetAccount],
        liabilities: [LiabilityAccount],
        snapshots: [NetWorthSnapshot]
    ) throws {
        try assets.forEach(write)
        try liabilities.forEach(write)
        try snapshots.forEach(write)
    }

    private static func importVaultFiles(into context: ModelContext) throws -> VaultImportResult {
        var existingAssets = Dictionary(uniqueKeysWithValues: try context.fetch(FetchDescriptor<AssetAccount>()).map { ($0.uid, $0) })
        var existingLiabilities = Dictionary(uniqueKeysWithValues: try context.fetch(FetchDescriptor<LiabilityAccount>()).map { ($0.uid, $0) })
        var existingSnapshots = Dictionary(uniqueKeysWithValues: try context.fetch(FetchDescriptor<NetWorthSnapshot>()).map { ($0.uid, $0) })

        var result = VaultImportResult()

        for url in try ICloudVaultService.recordURLs(in: .assets) {
            let record = try ICloudVaultService.readJSON(VaultAssetRecord.self, from: url)
            guard record.schema == VaultRecordCodec.assetSchema else { continue }

            let asset = existingAssets[record.uid] ?? AssetAccount(
                uid: record.uid,
                name: record.name,
                type: AssetType(rawValue: record.type) ?? .other,
                amount: VaultRecordCodec.decimal(from: record.amount),
                risk: RiskLevel(rawValue: record.risk) ?? .low,
                liquidity: LiquidityLevel(rawValue: record.liquidity) ?? .high
            )
            VaultRecordCodec.apply(record, to: asset)

            if existingAssets[record.uid] == nil {
                context.insert(asset)
                existingAssets[record.uid] = asset
                result.insertedAssetCount += 1
            } else {
                result.updatedAssetCount += 1
            }
        }

        for url in try ICloudVaultService.recordURLs(in: .liabilities) {
            let record = try ICloudVaultService.readJSON(VaultLiabilityRecord.self, from: url)
            guard record.schema == VaultRecordCodec.liabilitySchema else { continue }

            let liability = existingLiabilities[record.uid] ?? LiabilityAccount(
                uid: record.uid,
                name: record.name,
                type: LiabilityType(rawValue: record.type) ?? .other,
                amount: VaultRecordCodec.decimal(from: record.amount)
            )
            VaultRecordCodec.apply(record, to: liability)

            if existingLiabilities[record.uid] == nil {
                context.insert(liability)
                existingLiabilities[record.uid] = liability
                result.insertedLiabilityCount += 1
            } else {
                result.updatedLiabilityCount += 1
            }
        }

        for url in try ICloudVaultService.recordURLs(in: .snapshots) {
            let record = try ICloudVaultService.readJSON(VaultSnapshotRecord.self, from: url)
            guard record.schema == VaultRecordCodec.snapshotSchema else { continue }

            let snapshot = existingSnapshots[record.uid] ?? NetWorthSnapshot(
                uid: record.uid,
                totalAssets: VaultRecordCodec.decimal(from: record.totalAssets),
                totalLiabilities: VaultRecordCodec.decimal(from: record.totalLiabilities),
                netWorth: VaultRecordCodec.decimal(from: record.netWorth)
            )
            VaultRecordCodec.apply(record, to: snapshot)

            let existingItems = Dictionary(uniqueKeysWithValues: snapshot.items.map { ($0.uid, $0) })
            var importedItemUIDs = Set<String>()
            snapshot.items = record.items.map { itemRecord in
                let item = existingItems[itemRecord.uid] ?? SnapshotItem(
                    uid: itemRecord.uid,
                    sourceName: itemRecord.sourceName,
                    amount: VaultRecordCodec.decimal(from: itemRecord.amount),
                    category: itemRecord.category,
                    snapshot: snapshot
                )

                item.sourceName = itemRecord.sourceName
                item.amount = VaultRecordCodec.decimal(from: itemRecord.amount)
                item.category = itemRecord.category
                item.risk = RiskLevel(rawValue: itemRecord.risk) ?? .low
                item.liquidity = LiquidityLevel(rawValue: itemRecord.liquidity) ?? .high
                item.isLiability = itemRecord.isLiability
                item.snapshot = snapshot

                if existingItems[itemRecord.uid] == nil {
                    context.insert(item)
                }
                importedItemUIDs.insert(itemRecord.uid)
                return item
            }

            existingItems
                .filter { !importedItemUIDs.contains($0.key) }
                .forEach { context.delete($0.value) }

            if existingSnapshots[record.uid] == nil {
                context.insert(snapshot)
                existingSnapshots[record.uid] = snapshot
                result.insertedSnapshotCount += 1
            } else {
                result.updatedSnapshotCount += 1
            }
        }

        return result
    }

    private static func assetFilename(uid: String) -> String {
        "asset-\(safeFilenameComponent(uid)).json"
    }

    private static func liabilityFilename(uid: String) -> String {
        "liability-\(safeFilenameComponent(uid)).json"
    }

    private static func snapshotFilename(_ snapshot: NetWorthSnapshot) -> String {
        "snapshot-\(snapshot.date.formatted(.iso8601.year().month().day()))-\(safeFilenameComponent(snapshot.uid)).json"
    }

    private static func safeFilenameComponent(_ value: String) -> String {
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-_"))
        return value.unicodeScalars.map { allowed.contains($0) ? Character($0) : "-" }.map(String.init).joined()
    }
}

struct VaultImportResult {
    var insertedAssetCount = 0
    var updatedAssetCount = 0
    var insertedLiabilityCount = 0
    var updatedLiabilityCount = 0
    var insertedSnapshotCount = 0
    var updatedSnapshotCount = 0
}
