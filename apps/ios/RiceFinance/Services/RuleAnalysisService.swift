import Foundation

struct RuleInsight: Identifiable {
    enum Level {
        case positive
        case warning
        case info
    }

    let id = UUID()
    let title: String
    let message: String
    let level: Level
}

enum RuleAnalysisService {
    static func analyze(summary: FinancialSummary) -> [RuleInsight] {
        var insights: [RuleInsight] = []

        let cashRatio = ratio(for: "现金", in: summary.typeAllocations)
        if cashRatio > 0.5 {
            insights.append(.init(title: "现金占比较高", message: "现金类资产超过总资产 50%，资金安全垫充足，但可以关注长期收益效率。", level: .info))
        } else if cashRatio < 0.1 && summary.totalAssets > 0 {
            insights.append(.init(title: "现金缓冲偏低", message: "现金类资产低于总资产 10%，建议确认应急资金是否足够覆盖 3-6 个月开支。", level: .warning))
        }

        let highRiskRatio = ratio(for: "高风险", in: summary.riskAllocations)
        if highRiskRatio > 0.4 {
            insights.append(.init(title: "高风险资产偏高", message: "高风险资产超过 40%，净资产波动可能变大，适合结合风险承受能力复核配置。", level: .warning))
        }

        let lowLiquidityRatio = ratio(for: "低流动性", in: summary.liquidityAllocations)
        if lowLiquidityRatio > 0.35 {
            insights.append(.init(title: "低流动性资产偏高", message: "低流动性资产超过 35%，遇到大额支出时可能需要更早规划资金。", level: .warning))
        }

        if let name = summary.largestAccountName, summary.largestAccountRatio > 0.45 {
            insights.append(.init(title: "账户集中度较高", message: "\(name) 占总资产超过 45%，建议关注单一平台或单一账户风险。", level: .warning))
        }

        if insights.isEmpty {
            insights.append(.init(title: "结构暂未发现明显异常", message: "当前资产在风险、流动性和账户集中度上较为均衡，可以持续通过月度快照观察变化。", level: .positive))
        }

        return insights
    }

    private static func ratio(for title: String, in allocations: [AllocationItem]) -> Double {
        allocations.first { $0.title == title }?.ratio ?? 0
    }
}
