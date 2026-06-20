import SwiftData
import SwiftUI

struct AnalysisView: View {
    @Query(sort: \AssetAccount.updatedAt, order: .reverse) private var assets: [AssetAccount]
    @Query(sort: \LiabilityAccount.updatedAt, order: .reverse) private var liabilities: [LiabilityAccount]
    @Query(sort: \NetWorthSnapshot.date, order: .reverse) private var snapshots: [NetWorthSnapshot]

    private var summary: FinancialSummary {
        FinancialSummaryService.makeSummary(assets: assets, liabilities: liabilities, snapshots: snapshots)
    }

    private var insights: [RuleInsight] {
        RuleAnalysisService.analyze(summary: summary)
    }

    var body: some View {
        NavigationStack {
            List {
                Section("资产类型") {
                    allocationRows(summary.typeAllocations, tint: .blue)
                }

                Section("风险等级") {
                    allocationRows(summary.riskAllocations, tint: .orange)
                }

                Section("流动性") {
                    allocationRows(summary.liquidityAllocations, tint: .mint)
                }

                Section("规则提醒") {
                    ForEach(insights) { insight in
                        InsightRow(insight: insight)
                    }
                }
            }
            .navigationTitle("分析")
        }
    }

    @ViewBuilder
    private func allocationRows(_ items: [AllocationItem], tint: Color) -> some View {
        if items.isEmpty {
            ContentUnavailableView("暂无数据", systemImage: "chart.pie", description: Text("录入资产后会自动生成占比。"))
        } else {
            ForEach(items) { item in
                AllocationRow(item: item, tint: tint)
            }
        }
    }
}
