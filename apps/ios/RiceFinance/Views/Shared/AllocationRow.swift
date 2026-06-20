import SwiftUI

struct AllocationRow: View {
    let item: AllocationItem
    var tint: Color = .blue

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(item.title)
                    .font(.subheadline.weight(.medium))
                Spacer()
                Text(CurrencyFormatter.short(item.amount))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Text(PercentFormatter.short(item.ratio))
                    .font(.subheadline.monospacedDigit())
                    .frame(width: 56, alignment: .trailing)
            }

            ProgressView(value: item.ratio)
                .tint(tint)
        }
        .padding(.vertical, 4)
    }
}
