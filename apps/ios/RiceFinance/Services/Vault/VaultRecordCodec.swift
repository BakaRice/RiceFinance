import Foundation

struct VaultAssetRecord: Codable {
    var schema: String
    var version: Int
    var uid: String
    var name: String
    var type: String
    var platform: String
    var currency: String
    var amount: String
    var shareCount: String?
    var risk: String
    var liquidity: String
    var note: String
    var updatedAt: Date
}

struct VaultLiabilityRecord: Codable {
    var schema: String
    var version: Int
    var uid: String
    var name: String
    var type: String
    var currency: String
    var amount: String
    var dueDate: Date?
    var note: String
    var updatedAt: Date
}

struct VaultSnapshotRecord: Codable {
    var schema: String
    var version: Int
    var uid: String
    var date: Date
    var totalAssets: String
    var totalLiabilities: String
    var netWorth: String
    var currency: String
    var note: String
    var items: [VaultSnapshotItemRecord]
}

struct VaultSnapshotItemRecord: Codable {
    var uid: String
    var sourceName: String
    var amount: String
    var category: String
    var risk: String
    var liquidity: String
    var isLiability: Bool
}

enum VaultRecordCodec {
    static let assetSchema = "ricefinance.asset"
    static let liabilitySchema = "ricefinance.liability"
    static let snapshotSchema = "ricefinance.snapshot"
    static let version = 1

    static func assetRecord(from asset: AssetAccount) -> VaultAssetRecord {
        VaultAssetRecord(
            schema: assetSchema,
            version: version,
            uid: asset.uid,
            name: asset.name,
            type: asset.typeRawValue,
            platform: asset.platform,
            currency: asset.currencyRawValue,
            amount: string(from: asset.amount),
            shareCount: asset.shareCount.map(string(from:)),
            risk: asset.riskRawValue,
            liquidity: asset.liquidityRawValue,
            note: asset.note,
            updatedAt: asset.updatedAt
        )
    }

    static func liabilityRecord(from liability: LiabilityAccount) -> VaultLiabilityRecord {
        VaultLiabilityRecord(
            schema: liabilitySchema,
            version: version,
            uid: liability.uid,
            name: liability.name,
            type: liability.typeRawValue,
            currency: liability.currencyRawValue,
            amount: string(from: liability.amount),
            dueDate: liability.dueDate,
            note: liability.note,
            updatedAt: liability.updatedAt
        )
    }

    static func snapshotRecord(from snapshot: NetWorthSnapshot) -> VaultSnapshotRecord {
        VaultSnapshotRecord(
            schema: snapshotSchema,
            version: version,
            uid: snapshot.uid,
            date: snapshot.date,
            totalAssets: string(from: snapshot.totalAssets),
            totalLiabilities: string(from: snapshot.totalLiabilities),
            netWorth: string(from: snapshot.netWorth),
            currency: snapshot.currencyRawValue,
            note: snapshot.note,
            items: snapshot.items.map {
                VaultSnapshotItemRecord(
                    uid: $0.uid,
                    sourceName: $0.sourceName,
                    amount: string(from: $0.amount),
                    category: $0.category,
                    risk: $0.riskRawValue,
                    liquidity: $0.liquidityRawValue,
                    isLiability: $0.isLiability
                )
            }
        )
    }

    static func apply(_ record: VaultAssetRecord, to asset: AssetAccount) {
        asset.name = record.name
        asset.type = AssetType(rawValue: record.type) ?? .other
        asset.platform = record.platform
        asset.currency = CurrencyCode(rawValue: record.currency) ?? .cny
        asset.amount = decimal(from: record.amount)
        asset.shareCount = record.shareCount.map(decimal(from:))
        asset.risk = RiskLevel(rawValue: record.risk) ?? .low
        asset.liquidity = LiquidityLevel(rawValue: record.liquidity) ?? .high
        asset.note = record.note
        asset.updatedAt = record.updatedAt
    }

    static func apply(_ record: VaultLiabilityRecord, to liability: LiabilityAccount) {
        liability.name = record.name
        liability.type = LiabilityType(rawValue: record.type) ?? .other
        liability.currency = CurrencyCode(rawValue: record.currency) ?? .cny
        liability.amount = decimal(from: record.amount)
        liability.dueDate = record.dueDate
        liability.note = record.note
        liability.updatedAt = record.updatedAt
    }

    static func apply(_ record: VaultSnapshotRecord, to snapshot: NetWorthSnapshot) {
        snapshot.date = record.date
        snapshot.totalAssets = decimal(from: record.totalAssets)
        snapshot.totalLiabilities = decimal(from: record.totalLiabilities)
        snapshot.netWorth = decimal(from: record.netWorth)
        snapshot.currency = CurrencyCode(rawValue: record.currency) ?? .cny
        snapshot.note = record.note
    }

    static func string(from decimal: Decimal) -> String {
        NSDecimalNumber(decimal: decimal).stringValue
    }

    static func decimal(from string: String) -> Decimal {
        Decimal(string: string) ?? .zero
    }
}
