import Foundation

struct AllocationItem: Identifiable {
    let id = UUID()
    let title: String
    let amount: Decimal
    let ratio: Double
}

struct FinancialSummary {
    let totalAssets: Decimal
    let totalLiabilities: Decimal
    let netWorth: Decimal
    let previousNetWorth: Decimal?
    let typeAllocations: [AllocationItem]
    let riskAllocations: [AllocationItem]
    let liquidityAllocations: [AllocationItem]
    let largestAccountName: String?
    let largestAccountRatio: Double

    var netWorthChange: Decimal? {
        guard let previousNetWorth else { return nil }
        return netWorth - previousNetWorth
    }

    var netWorthChangeRate: Double? {
        guard let previousNetWorth, previousNetWorth != 0 else { return nil }
        return NSDecimalNumber(decimal: netWorth - previousNetWorth).doubleValue / NSDecimalNumber(decimal: previousNetWorth).doubleValue
    }
}

enum FinancialSummaryService {
    static func makeSummary(
        assets: [AssetAccount],
        liabilities: [LiabilityAccount],
        snapshots: [NetWorthSnapshot] = []
    ) -> FinancialSummary {
        let totalAssets = assets.reduce(Decimal.zero) { $0 + $1.amount }
        let totalLiabilities = liabilities.reduce(Decimal.zero) { $0 + $1.amount }
        let netWorth = totalAssets - totalLiabilities
        let previousNetWorth = snapshots.sorted { $0.date > $1.date }.first?.netWorth

        let largest = assets.max { $0.amount < $1.amount }
        let largestRatio = ratio(largest?.amount ?? 0, total: totalAssets)

        return FinancialSummary(
            totalAssets: totalAssets,
            totalLiabilities: totalLiabilities,
            netWorth: netWorth,
            previousNetWorth: previousNetWorth,
            typeAllocations: allocation(
                values: AssetType.allCases.map { type in
                    (type.title, assets.filter { $0.type == type }.reduce(Decimal.zero) { $0 + $1.amount })
                },
                total: totalAssets
            ),
            riskAllocations: allocation(
                values: RiskLevel.allCases.map { risk in
                    (risk.title, assets.filter { $0.risk == risk }.reduce(Decimal.zero) { $0 + $1.amount })
                },
                total: totalAssets
            ),
            liquidityAllocations: allocation(
                values: LiquidityLevel.allCases.map { liquidity in
                    (liquidity.title, assets.filter { $0.liquidity == liquidity }.reduce(Decimal.zero) { $0 + $1.amount })
                },
                total: totalAssets
            ),
            largestAccountName: largest?.name,
            largestAccountRatio: largestRatio
        )
    }

    private static func allocation(values: [(String, Decimal)], total: Decimal) -> [AllocationItem] {
        values
            .filter { $0.1 > 0 }
            .map { AllocationItem(title: $0.0, amount: $0.1, ratio: ratio($0.1, total: total)) }
            .sorted { $0.amount > $1.amount }
    }

    private static func ratio(_ value: Decimal, total: Decimal) -> Double {
        guard total > 0 else { return 0 }
        return NSDecimalNumber(decimal: value).doubleValue / NSDecimalNumber(decimal: total).doubleValue
    }
}
