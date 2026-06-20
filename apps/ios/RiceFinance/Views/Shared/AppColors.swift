import SwiftUI

enum AppColors {
    static var groupedBackground: Color {
        #if os(iOS)
        Color(UIColor.systemGroupedBackground)
        #elseif os(macOS)
        Color(NSColor.windowBackgroundColor)
        #else
        Color(.background)
        #endif
    }

    static var secondaryGroupedBackground: Color {
        #if os(iOS)
        Color(UIColor.secondarySystemGroupedBackground)
        #elseif os(macOS)
        Color(NSColor.controlBackgroundColor)
        #else
        Color(.background)
        #endif
    }
}
