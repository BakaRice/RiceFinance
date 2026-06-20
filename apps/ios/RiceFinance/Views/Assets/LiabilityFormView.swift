import SwiftData
import SwiftUI

struct LiabilityFormView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext

    private let liability: LiabilityAccount?
    @State private var name: String
    @State private var type: LiabilityType
    @State private var currency: CurrencyCode
    @State private var amountText: String
    @State private var hasDueDate: Bool
    @State private var dueDate: Date
    @State private var note: String
    @State private var showingAdvancedFields: Bool
    @State private var saveErrorMessage: String?
    @State private var showingSaveError = false

    init(liability: LiabilityAccount? = nil) {
        self.liability = liability
        _name = State(initialValue: liability?.name ?? "")
        _type = State(initialValue: liability?.type ?? .creditCard)
        _currency = State(initialValue: liability?.currency ?? .cny)
        _amountText = State(initialValue: liability.map { NSDecimalNumber(decimal: $0.amount).stringValue } ?? "")
        _hasDueDate = State(initialValue: liability?.dueDate != nil)
        _dueDate = State(initialValue: liability?.dueDate ?? .now)
        _note = State(initialValue: liability?.note ?? "")
        _showingAdvancedFields = State(initialValue: liability.map {
            $0.currency != .cny || $0.dueDate != nil || !$0.note.isEmpty
        } ?? false)
    }

    var body: some View {
        Form {
            Section {
                TextField("名称", text: $name)
                Picker("负债类型", selection: $type) {
                    ForEach(LiabilityType.allCases) { item in
                        Text(item.title).tag(item)
                    }
                }
                TextField("金额", text: $amountText)
                    .keyboardType(.decimalPad)
            }

            Section {
                DisclosureGroup("更多信息", isExpanded: $showingAdvancedFields) {
                    Picker("币种", selection: $currency) {
                        ForEach(CurrencyCode.allCases) { item in
                            Text(item.title).tag(item)
                        }
                    }

                    Toggle("设置到期日", isOn: $hasDueDate)
                    if hasDueDate {
                        DatePicker("到期日", selection: $dueDate, displayedComponents: .date)
                    }

                    TextField("备注（可选）", text: $note, axis: .vertical)
                        .lineLimit(3...6)
                }
            }
        }
        .navigationTitle(liability == nil ? "新增负债" : "编辑负债")
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

    private func save() {
        guard let amount = parsedAmount else { return }
        do {
            if let liability {
                liability.name = name
                liability.type = type
                liability.currency = currency
                liability.amount = amount
                liability.dueDate = hasDueDate ? dueDate : nil
                liability.note = note
                liability.updatedAt = .now
                try VaultSyncService.write(liability)
            } else {
                let liability = LiabilityAccount(
                    name: name,
                    type: type,
                    currency: currency,
                    amount: amount,
                    dueDate: hasDueDate ? dueDate : nil,
                    note: note
                )
                try VaultSyncService.write(liability)
                modelContext.insert(liability)
            }
            dismiss()
        } catch {
            saveErrorMessage = "保存到文件库失败：\(error.localizedDescription)"
            showingSaveError = true
        }
    }
}
