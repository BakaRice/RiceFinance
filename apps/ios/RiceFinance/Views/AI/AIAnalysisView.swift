import SwiftData
import SwiftUI

struct AIAnalysisView: View {
    @Query(sort: \AssetAccount.updatedAt, order: .reverse) private var assets: [AssetAccount]
    @Query(sort: \LiabilityAccount.updatedAt, order: .reverse) private var liabilities: [LiabilityAccount]
    @Query(sort: \NetWorthSnapshot.date, order: .reverse) private var snapshots: [NetWorthSnapshot]
    @State private var statusMessage: String?
    @State private var showingStatus = false

    private var summary: FinancialSummary {
        FinancialSummaryService.makeSummary(assets: assets, liabilities: liabilities, snapshots: snapshots)
    }

    private var report: AIAnalysisReport {
        AIAnalysisService.generateReport(summary: summary, insights: RuleAnalysisService.analyze(summary: summary))
    }

    var body: some View {
        NavigationStack {
            List {
                Section("财务状态总结") {
                    Text(report.summary)
                }

                Section("当前亮点") {
                    bulletList(report.highlights, icon: "checkmark.circle.fill", tint: .green)
                }

                Section("潜在风险") {
                    bulletList(report.risks, icon: "exclamationmark.triangle.fill", tint: .orange)
                }

                Section("下月建议") {
                    bulletList(report.nextActions, icon: "arrow.right.circle.fill", tint: .blue)
                }

                Section("免责声明") {
                    Text(report.disclaimer)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("AI 复盘")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        saveReport()
                    } label: {
                        Label("保存报告", systemImage: "square.and.arrow.down")
                    }
                }
            }
            .alert(statusMessage ?? "", isPresented: $showingStatus) {
                Button("好", role: .cancel) {}
            }
        }
    }

    private func bulletList(_ items: [String], icon: String, tint: Color) -> some View {
        ForEach(items, id: \.self) { item in
            Label(item, systemImage: icon)
                .foregroundStyle(.primary, tint)
        }
    }

    private func saveReport() {
        do {
            try VaultSyncService.writeReport(markdown: report.markdown())
            statusMessage = "报告已保存到 \(ICloudVaultService.locationDescription)/reports。"
            showingStatus = true
        } catch {
            statusMessage = "保存报告失败：\(error.localizedDescription)"
            showingStatus = true
        }
    }
}
