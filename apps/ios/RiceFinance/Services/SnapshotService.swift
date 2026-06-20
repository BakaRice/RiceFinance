import Foundation
import SwiftData

enum SnapshotService {
    @discardableResult
    static func createSnapshot(
        assets: [AssetAccount],
        liabilities: [LiabilityAccount],
        context: ModelContext,
        note: String = ""
    ) -> NetWorthSnapshot {
        let summary = FinancialSummaryService.makeSummary(assets: assets, liabilities: liabilities)
        let snapshot = NetWorthSnapshot(
            totalAssets: summary.totalAssets,
            totalLiabilities: summary.totalLiabilities,
            netWorth: summary.netWorth,
            note: note
        )

        let assetItems = assets.map {
            SnapshotItem(
                sourceName: $0.name,
                amount: $0.amount,
                category: $0.type.title,
                risk: $0.risk,
                liquidity: $0.liquidity,
                snapshot: snapshot
            )
        }

        let liabilityItems = liabilities.map {
            SnapshotItem(
                sourceName: $0.name,
                amount: $0.amount,
                category: $0.type.title,
                isLiability: true,
                snapshot: snapshot
            )
        }

        snapshot.items = assetItems + liabilityItems
        context.insert(snapshot)
        return snapshot
    }
}
