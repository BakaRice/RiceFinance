import SwiftUI

struct InsightRow: View {
    let insight: RuleInsight

    var body: some View {
        Label {
            VStack(alignment: .leading, spacing: 4) {
                Text(insight.title)
                    .font(.subheadline.weight(.semibold))
                Text(insight.message)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        } icon: {
            Image(systemName: iconName)
                .foregroundStyle(tint)
        }
    }

    private var iconName: String {
        switch insight.level {
        case .positive: "checkmark.circle.fill"
        case .warning: "exclamationmark.triangle.fill"
        case .info: "info.circle.fill"
        }
    }

    private var tint: Color {
        switch insight.level {
        case .positive: .green
        case .warning: .orange
        case .info: .blue
        }
    }
}
