import SwiftData
import SwiftUI

struct AssetFormView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext

    private let asset: AssetAccount?
    @State private var name: String
    @State private var type: AssetType
    @State private var platform: String
    @State private var currency: CurrencyCode
    @State private var amountText: String
    @State private var shareCountText: String
    @State private var risk: RiskLevel
    @State private var liquidity: LiquidityLevel
    @State private var note: String
    @State private var showingAdvancedFields: Bool
    @State private var saveErrorMessage: String?
    @State private var showingSaveError = false

    init(asset: AssetAccount? = nil) {
        self.asset = asset
        _name = State(initialValue: asset?.name ?? "")
        _type = State(initialValue: asset?.type ?? .cash)
        _platform = State(initialValue: asset?.platform ?? "")
        _currency = State(initialValue: asset?.currency ?? .cny)
        _amountText = State(initialValue: asset.map { NSDecimalNumber(decimal: $0.amount).stringValue } ?? "")
        _shareCountText = State(initialValue: asset?.shareCount.map { NSDecimalNumber(decimal: $0).stringValue } ?? "")
        _risk = State(initialValue: asset?.risk ?? .low)
        _liquidity = State(initialValue: asset?.liquidity ?? .high)
        _note = State(initialValue: asset?.note ?? "")
        _showingAdvancedFields = State(initialValue: asset.map {
            !$0.platform.isEmpty || $0.currency != .cny || $0.risk != .low || $0.liquidity != .high || !$0.note.isEmpty
        } ?? false)
    }

    var body: some View {
        Form {
            Section {
                TextField("名称", text: $name)
                Picker("资产类型", selection: $type) {
                    ForEach(AssetType.allCases) { item in
                        Text(item.title).tag(item)
                    }
                }
                TextField(amountPlaceholder, text: $amountText)
                    .keyboardType(.decimalPad)

                if type == .fund {
                    TextField("基金份额（可选）", text: $shareCountText)
                        .keyboardType(.decimalPad)
                }
            }

            Section {
                DisclosureGroup("更多信息", isExpanded: $showingAdvancedFields) {
                    TextField("平台 / 账户（可选）", text: $platform)

                    Picker("币种", selection: $currency) {
                        ForEach(CurrencyCode.allCases) { item in
                            Text(item.title).tag(item)
                        }
                    }

                    Picker("风险等级", selection: $risk) {
                        ForEach(RiskLevel.allCases) { item in
                            Text(item.title).tag(item)
                        }
                    }

                    Picker("流动性", selection: $liquidity) {
                        ForEach(LiquidityLevel.allCases) { item in
                            Text(item.title).tag(item)
                        }
                    }

                    TextField("备注（可选）", text: $note, axis: .vertical)
                        .lineLimit(3...6)
                }
            }
        }
        .navigationTitle(asset == nil ? "新增资产" : "编辑资产")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("取消") {
                    dismiss()
                }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button("保存", action: save)
                    .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || parsedAmount == nil)
            }
        }
        .alert(saveErrorMessage ?? "", isPresented: $showingSaveError) {
            Button("好", role: .cancel) {}
        }
    }

    private var parsedAmount: Decimal? {
        Decimal(string: amountText.trimmingCharacters(in: .whitespacesAndNewlines))
    }

    private var parsedShareCount: Decimal? {
        Decimal(string: shareCountText.trimmingCharacters(in: .whitespacesAndNewlines))
    }

    private var amountPlaceholder: String {
        type == .fund ? "当前市值 / 金额" : "金额"
    }

    private func save() {
        guard let amount = parsedAmount else { return }
        do {
            if let asset {
                asset.name = name
                asset.type = type
                asset.platform = platform
                asset.currency = currency
                asset.amount = amount
                asset.shareCount = type == .fund ? parsedShareCount : nil
                asset.risk = risk
                asset.liquidity = liquidity
                asset.note = note
                asset.updatedAt = .now
                try VaultSyncService.write(asset)
            } else {
                let asset = AssetAccount(
                    name: name,
                    type: type,
                    platform: platform,
                    currency: currency,
                    amount: amount,
                    shareCount: type == .fund ? parsedShareCount : nil,
                    risk: risk,
                    liquidity: liquidity,
                    note: note
                )
                try VaultSyncService.write(asset)
                modelContext.insert(asset)
            }
            dismiss()
        } catch {
            saveErrorMessage = "保存到文件库失败：\(error.localizedDescription)"
            showingSaveError = true
        }
    }
}
