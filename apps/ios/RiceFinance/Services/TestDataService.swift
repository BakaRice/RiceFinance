import Foundation
import SwiftData

enum TestDataPreset: CaseIterable, Identifiable {
    case starter
    case balanced
    case stress

    var id: String {
        switch self {
        case .starter: "starter"
        case .balanced: "balanced"
        case .stress: "stress"
        }
    }

    var title: String {
        switch self {
        case .starter: "生成 1 组"
        case .balanced: "生成 5 组"
        case .stress: "生成 20 组"
        }
    }

    var systemImage: String {
        switch self {
        case .starter: "sparkle"
        case .balanced: "square.stack.3d.up"
        case .stress: "flame"
        }
    }

    var batchCount: Int {
        switch self {
        case .starter: 1
        case .balanced: 5
        case .stress: 20
        }
    }
}

struct TestDataGenerationResult {
    let assetCount: Int
    let liabilityCount: Int
    let snapshotCount: Int
}

@MainActor
enum TestDataService {
    @discardableResult
    static func generate(
        preset: TestDataPreset,
        existingAssets: [AssetAccount],
        existingLiabilities: [LiabilityAccount],
        into context: ModelContext
    ) throws -> TestDataGenerationResult {
        var generatedAssets = [AssetAccount]()
        var generatedLiabilities = [LiabilityAccount]()
        var snapshotCount = 0
        let runLabel = Date.now.formatted(.dateTime.month(.twoDigits).day(.twoDigits).hour().minute().second())

        for index in 1...preset.batchCount {
            let batch = makeBatch(index: index, runLabel: runLabel)
            batch.assets.forEach {
                context.insert($0)
                generatedAssets.append($0)
            }
            batch.liabilities.forEach {
                context.insert($0)
                generatedLiabilities.append($0)
            }

            let allAssets = existingAssets + generatedAssets
            let allLiabilities = existingLiabilities + generatedLiabilities
            let snapshot = SnapshotService.createSnapshot(
                assets: allAssets,
                liabilities: allLiabilities,
                context: context,
                note: "测试数据自动快照 \(runLabel) #\(index)"
            )
            snapshot.date = Calendar.current.date(byAdding: .month, value: -preset.batchCount + index, to: .now) ?? .now
            snapshotCount += 1
        }

        try context.save()
        try VaultSyncService.writeCachedData(from: context)
        return TestDataGenerationResult(
            assetCount: generatedAssets.count,
            liabilityCount: generatedLiabilities.count,
            snapshotCount: snapshotCount
        )
    }

    private static func makeBatch(index: Int, runLabel: String) -> (assets: [AssetAccount], liabilities: [LiabilityAccount]) {
        let multiplier = Decimal(index)
        let suffix = "#\(index)"
        let note = "测试数据 \(runLabel)"

        let assets = [
            AssetAccount(
                name: "活期现金 \(suffix)",
                type: .cash,
                platform: "招商银行",
                amount: decimal(12000) + decimal(900) * multiplier,
                risk: .low,
                liquidity: .high,
                note: note
            ),
            AssetAccount(
                name: "三个月定存 \(suffix)",
                type: .deposit,
                platform: "工商银行",
                amount: decimal(65000) + decimal(2800) * multiplier,
                risk: .low,
                liquidity: .medium,
                note: note
            ),
            AssetAccount(
                name: "短债基金 \(suffix)",
                type: .fixedIncome,
                platform: "支付宝",
                amount: decimal(48000) + decimal(2100) * multiplier,
                shareCount: decimal(42000) + decimal(300) * multiplier,
                risk: .low,
                liquidity: .high,
                note: note
            ),
            AssetAccount(
                name: "沪深 300 指数 \(suffix)",
                type: .fund,
                platform: "天天基金",
                amount: decimal(76000) + decimal(5200) * multiplier,
                shareCount: decimal(36000) + decimal(420) * multiplier,
                risk: .medium,
                liquidity: .high,
                note: note
            ),
            AssetAccount(
                name: "成长股票组合 \(suffix)",
                type: .stock,
                platform: "东方财富",
                amount: decimal(92000) + decimal(7300) * multiplier,
                risk: .high,
                liquidity: .high,
                note: note
            ),
            AssetAccount(
                name: "黄金 ETF \(suffix)",
                type: .commodity,
                platform: "证券账户",
                amount: decimal(31000) + decimal(1600) * multiplier,
                shareCount: decimal(8600) + decimal(120) * multiplier,
                risk: .medium,
                liquidity: .high,
                note: note
            ),
            AssetAccount(
                name: "美元现金 \(suffix)",
                type: .foreignCurrency,
                platform: "中银香港",
                currency: .usd,
                amount: decimal(8400) + decimal(500) * multiplier,
                risk: .low,
                liquidity: .high,
                note: note
            )
        ]

        let liabilities = [
            LiabilityAccount(
                name: "信用卡账单 \(suffix)",
                type: .creditCard,
                amount: decimal(6200) + decimal(450) * multiplier,
                dueDate: Calendar.current.date(byAdding: .day, value: 18, to: .now),
                note: note
            ),
            LiabilityAccount(
                name: "消费分期 \(suffix)",
                type: .consumerLoan,
                amount: decimal(18000) + decimal(900) * multiplier,
                dueDate: Calendar.current.date(byAdding: .month, value: 8, to: .now),
                note: note
            ),
            LiabilityAccount(
                name: "房贷余额 \(suffix)",
                type: .mortgage,
                amount: decimal(420000) + decimal(6000) * multiplier,
                dueDate: Calendar.current.date(byAdding: .year, value: 18, to: .now),
                note: note
            )
        ]

        return (assets, liabilities)
    }

    private static func decimal(_ value: Int) -> Decimal {
        Decimal(value)
    }
}
