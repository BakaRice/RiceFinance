import SwiftUI

struct SnapshotDetailView: View {
    let snapshot: NetWorthSnapshot

    var body: some View {
        List {
            Section("汇总") {
                LabeledContent("总资产", value: CurrencyFormatter.short(snapshot.totalAssets))
                LabeledContent("总负债", value: CurrencyFormatter.short(snapshot.totalLiabilities))
                LabeledContent("净资产", value: CurrencyFormatter.short(snapshot.netWorth))
                LabeledContent("生成时间", value: snapshot.date.formatted(date: .abbreviated, time: .shortened))
            }

            Section("明细") {
                if snapshot.items.isEmpty {
                    ContentUnavailableView("暂无明细", systemImage: "list.bullet")
                } else {
                    ForEach(snapshot.items.sorted { $0.amount > $1.amount }) { item in
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(item.sourceName)
                                    .font(.headline)
                                Text(item.category)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text(CurrencyFormatter.short(item.amount))
                                .foregroundStyle(item.isLiability ? .red : .primary)
                        }
                    }
                }
            }
        }
        .navigationTitle("快照详情")
    }
}
