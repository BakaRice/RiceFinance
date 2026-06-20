import Foundation
import SwiftData
import SwiftUI
import UniformTypeIdentifiers

struct RiceFinanceExportDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.json] }
    static var writableContentTypes: [UTType] { [.json] }

    var data: Data

    init(data: Data = Data()) {
        self.data = data
    }

    init(configuration: ReadConfiguration) throws {
        data = configuration.file.regularFileContents ?? Data()
    }

    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        FileWrapper(regularFileWithContents: data)
    }
}

struct RiceFinanceExportPackage: Codable {
    var schema: String
    var version: Int
    var exportedAt: Date
    var baseCurrency: String
    var assets: [AssetRecord]
    var liabilities: [LiabilityRecord]
    var snapshots: [SnapshotRecord]

    struct AssetRecord: Codable {
        var uid: String?
        var name: String
        var type: String
        var platform: String
        var currency: String
        var amount: Decimal
        var shareCount: Decimal?
        var risk: String
        var liquidity: String
        var note: String
        var updatedAt: Date
    }

    struct LiabilityRecord: Codable {
        var uid: String?
        var name: String
        var type: String
        var currency: String
        var amount: Decimal
        var dueDate: Date?
        var note: String
        var updatedAt: Date
    }

    struct SnapshotRecord: Codable {
        var uid: String?
        var date: Date
        var totalAssets: Decimal
        var totalLiabilities: Decimal
        var netWorth: Decimal
        var currency: String
        var note: String
        var items: [SnapshotItemRecord]
    }

    struct SnapshotItemRecord: Codable {
        var uid: String?
        var sourceName: String
        var amount: Decimal
        var category: String
        var risk: String
        var liquidity: String
        var isLiability: Bool
    }
}

enum ImportExportService {
    static let schema = "ricefinance.export"
    static let version = 2

    static func makeExportData(
        assets: [AssetAccount],
        liabilities: [LiabilityAccount],
        snapshots: [NetWorthSnapshot]
    ) throws -> Data {
        let package = RiceFinanceExportPackage(
            schema: schema,
            version: version,
            exportedAt: .now,
            baseCurrency: CurrencyCode.cny.rawValue,
            assets: assets.map {
                .init(
                    uid: $0.uid,
                    name: $0.name,
                    type: $0.typeRawValue,
                    platform: $0.platform,
                    currency: $0.currencyRawValue,
                    amount: $0.amount,
                    shareCount: $0.shareCount,
                    risk: $0.riskRawValue,
                    liquidity: $0.liquidityRawValue,
                    note: $0.note,
                    updatedAt: $0.updatedAt
                )
            },
            liabilities: liabilities.map {
                .init(
                    uid: $0.uid,
                    name: $0.name,
                    type: $0.typeRawValue,
                    currency: $0.currencyRawValue,
                    amount: $0.amount,
                    dueDate: $0.dueDate,
                    note: $0.note,
                    updatedAt: $0.updatedAt
                )
            },
            snapshots: snapshots.map {
                .init(
                    uid: $0.uid,
                    date: $0.date,
                    totalAssets: $0.totalAssets,
                    totalLiabilities: $0.totalLiabilities,
                    netWorth: $0.netWorth,
                    currency: $0.currencyRawValue,
                    note: $0.note,
                    items: $0.items.map {
                        .init(
                            uid: $0.uid,
                            sourceName: $0.sourceName,
                            amount: $0.amount,
                            category: $0.category,
                            risk: $0.riskRawValue,
                            liquidity: $0.liquidityRawValue,
                            isLiability: $0.isLiability
                        )
                    }
                )
            }
        )

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return try encoder.encode(package)
    }

    @discardableResult
    static func importData(_ data: Data, into context: ModelContext) throws -> ImportResult {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let package = try decoder.decode(RiceFinanceExportPackage.self, from: data)

        guard package.schema == schema, (1...version).contains(package.version) else {
            throw ImportError.unsupportedVersion
        }

        var existingAssets = Dictionary(uniqueKeysWithValues: try context.fetch(FetchDescriptor<AssetAccount>()).map { ($0.uid, $0) })
        var existingLiabilities = Dictionary(uniqueKeysWithValues: try context.fetch(FetchDescriptor<LiabilityAccount>()).map { ($0.uid, $0) })
        var existingSnapshots = Dictionary(uniqueKeysWithValues: try context.fetch(FetchDescriptor<NetWorthSnapshot>()).map { ($0.uid, $0) })

        var insertedAssets = 0
        var updatedAssets = 0
        var insertedLiabilities = 0
        var updatedLiabilities = 0
        var insertedSnapshots = 0
        var updatedSnapshots = 0

        package.assets.forEach { record in
            let uid = record.uid ?? legacyUID(prefix: "asset", values: [
                record.name,
                record.type,
                record.platform,
                record.currency,
                record.amount.description,
                record.shareCount?.description ?? "",
                record.risk,
                record.liquidity,
                record.note,
                record.updatedAt.ISO8601Format()
            ])
            let asset = existingAssets[uid] ?? AssetAccount(
                uid: uid,
                name: record.name,
                type: AssetType(rawValue: record.type) ?? .other,
                amount: record.amount,
                risk: RiskLevel(rawValue: record.risk) ?? .low,
                liquidity: LiquidityLevel(rawValue: record.liquidity) ?? .high
            )

            asset.name = record.name
            asset.type = AssetType(rawValue: record.type) ?? .other
            asset.platform = record.platform
            asset.currency = CurrencyCode(rawValue: record.currency) ?? .cny
            asset.amount = record.amount
            asset.shareCount = record.shareCount
            asset.risk = RiskLevel(rawValue: record.risk) ?? .low
            asset.liquidity = LiquidityLevel(rawValue: record.liquidity) ?? .high
            asset.note = record.note
            asset.updatedAt = record.updatedAt

            if existingAssets[uid] == nil {
                context.insert(asset)
                existingAssets[uid] = asset
                insertedAssets += 1
            } else {
                updatedAssets += 1
            }
        }

        package.liabilities.forEach { record in
            let uid = record.uid ?? legacyUID(prefix: "liability", values: [
                record.name,
                record.type,
                record.currency,
                record.amount.description,
                record.dueDate?.ISO8601Format() ?? "",
                record.note,
                record.updatedAt.ISO8601Format()
            ])
            let liability = existingLiabilities[uid] ?? LiabilityAccount(
                uid: uid,
                name: record.name,
                type: LiabilityType(rawValue: record.type) ?? .other,
                amount: record.amount
            )

            liability.name = record.name
            liability.type = LiabilityType(rawValue: record.type) ?? .other
            liability.currency = CurrencyCode(rawValue: record.currency) ?? .cny
            liability.amount = record.amount
            liability.dueDate = record.dueDate
            liability.note = record.note
            liability.updatedAt = record.updatedAt

            if existingLiabilities[uid] == nil {
                context.insert(liability)
                existingLiabilities[uid] = liability
                insertedLiabilities += 1
            } else {
                updatedLiabilities += 1
            }
        }

        package.snapshots.forEach { record in
            let uid = record.uid ?? legacyUID(prefix: "snapshot", values: [
                record.date.ISO8601Format(),
                record.totalAssets.description,
                record.totalLiabilities.description,
                record.netWorth.description,
                record.currency,
                record.note
            ])
            let snapshot = existingSnapshots[uid] ?? NetWorthSnapshot(
                uid: uid,
                totalAssets: record.totalAssets,
                totalLiabilities: record.totalLiabilities,
                netWorth: record.netWorth
            )

            snapshot.date = record.date
            snapshot.totalAssets = record.totalAssets
            snapshot.totalLiabilities = record.totalLiabilities
            snapshot.netWorth = record.netWorth
            snapshot.currency = CurrencyCode(rawValue: record.currency) ?? .cny
            snapshot.note = record.note

            let existingItems = Dictionary(uniqueKeysWithValues: snapshot.items.map { ($0.uid, $0) })
            var importedItemUIDs = Set<String>()
            snapshot.items = record.items.enumerated().map { offset, itemRecord in
                let itemUID = itemRecord.uid ?? legacyUID(prefix: "snapshot-item", values: [
                    uid,
                    String(offset),
                    itemRecord.sourceName,
                    itemRecord.amount.description,
                    itemRecord.category,
                    itemRecord.risk,
                    itemRecord.liquidity,
                    String(itemRecord.isLiability)
                ])
                let item = existingItems[itemUID] ?? SnapshotItem(
                    uid: itemUID,
                    sourceName: itemRecord.sourceName,
                    amount: itemRecord.amount,
                    category: itemRecord.category,
                    snapshot: snapshot
                )

                item.sourceName = itemRecord.sourceName
                item.amount = itemRecord.amount
                item.category = itemRecord.category
                item.risk = RiskLevel(rawValue: itemRecord.risk) ?? .low
                item.liquidity = LiquidityLevel(rawValue: itemRecord.liquidity) ?? .high
                item.isLiability = itemRecord.isLiability
                item.snapshot = snapshot

                if existingItems[itemUID] == nil {
                    context.insert(item)
                }
                importedItemUIDs.insert(itemUID)
                return item
            }
            existingItems
                .filter { !importedItemUIDs.contains($0.key) }
                .forEach { context.delete($0.value) }

            if existingSnapshots[uid] == nil {
                context.insert(snapshot)
                existingSnapshots[uid] = snapshot
                insertedSnapshots += 1
            } else {
                updatedSnapshots += 1
            }
        }

        try context.save()

        return ImportResult(
            assetCount: package.assets.count,
            liabilityCount: package.liabilities.count,
            snapshotCount: package.snapshots.count,
            insertedAssetCount: insertedAssets,
            updatedAssetCount: updatedAssets,
            insertedLiabilityCount: insertedLiabilities,
            updatedLiabilityCount: updatedLiabilities,
            insertedSnapshotCount: insertedSnapshots,
            updatedSnapshotCount: updatedSnapshots
        )
    }

    struct ImportResult {
        let assetCount: Int
        let liabilityCount: Int
        let snapshotCount: Int
        let insertedAssetCount: Int
        let updatedAssetCount: Int
        let insertedLiabilityCount: Int
        let updatedLiabilityCount: Int
        let insertedSnapshotCount: Int
        let updatedSnapshotCount: Int
    }

    enum ImportError: LocalizedError {
        case unsupportedVersion

        var errorDescription: String? {
            switch self {
            case .unsupportedVersion:
                "暂不支持该导入文件版本。"
            }
        }
    }

    private static func legacyUID(prefix: String, values: [String]) -> String {
        ([prefix] + values)
            .joined(separator: "\u{1F}")
            .data(using: .utf8)?
            .base64EncodedString()
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "=", with: "")
        ?? UUID().uuidString
    }
}
