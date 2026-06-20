import Foundation

struct AIAnalysisReport {
    let summary: String
    let highlights: [String]
    let risks: [String]
    let nextActions: [String]
    let disclaimer: String

    func markdown(generatedAt: Date = .now) -> String {
        """
        # RiceFinance AI 复盘

        生成时间：\(generatedAt.formatted(date: .abbreviated, time: .shortened))

        ## 财务状态总结

        \(summary)

        ## 当前亮点

        \(markdownList(highlights))

        ## 潜在风险

        \(markdownList(risks))

        ## 下月建议

        \(markdownList(nextActions))

        ## 免责声明

        \(disclaimer)
        """
    }

    private func markdownList(_ items: [String]) -> String {
        items.map { "- \($0)" }.joined(separator: "\n")
    }
}

enum AIAnalysisService {
    static func generateReport(summary: FinancialSummary, insights: [RuleInsight]) -> AIAnalysisReport {
        let changeText: String
        if let change = summary.netWorthChange, let rate = summary.netWorthChangeRate {
            changeText = "较上次快照变化 \(CurrencyFormatter.short(change))，变化率 \(PercentFormatter.short(rate))。"
        } else {
            changeText = "暂无历史快照，本次可以作为后续月度复盘的起点。"
        }

        let warnings = insights.filter { $0.level == .warning }.map(\.message)

        return AIAnalysisReport(
            summary: "当前净资产为 \(CurrencyFormatter.short(summary.netWorth))，总资产 \(CurrencyFormatter.short(summary.totalAssets))，总负债 \(CurrencyFormatter.short(summary.totalLiabilities))。\(changeText)",
            highlights: [
                "已形成可追踪的资产台账，后续每月更新即可看到净资产趋势。",
                summary.typeAllocations.first.map { "当前占比最高的资产类型是 \($0.title)，占 \(PercentFormatter.short($0.ratio))。" } ?? "资产结构数据会在录入账户后自动生成。"
            ],
            risks: warnings.isEmpty ? ["暂未发现明显结构性风险，建议继续关注现金储备、账户集中度和高风险资产占比。"] : warnings,
            nextActions: [
                "本月结束前更新一次各账户金额，并生成新的月度快照。",
                "为主要账户补充平台、风险等级和流动性等级，提升分析准确度。",
                "如果有大额支出计划，先检查现金储备和低流动性资产占比。"
            ],
            disclaimer: "本报告由本地规则生成，仅用于个人财务复盘，不构成投资建议。"
        )
    }
}
