import SwiftUI

struct RootTabView: View {
    var body: some View {
        #if targetEnvironment(macCatalyst)
        MacRootView()
        #else
        TabView {
            OverviewView()
                .tabItem {
                    Label("首页", systemImage: "house")
                }

            AssetListView()
                .tabItem {
                    Label("资产", systemImage: "list.bullet.rectangle")
                }

            AnalysisView()
                .tabItem {
                    Label("分析", systemImage: "chart.pie")
                }

            SnapshotListView()
                .tabItem {
                    Label("快照", systemImage: "calendar.badge.clock")
                }

            AIAnalysisView()
                .tabItem {
                    Label("AI", systemImage: "sparkles")
                }
        }
        #endif
    }
}

#if targetEnvironment(macCatalyst)
private struct MacRootView: View {
    @State private var selection: AppSection? = .overview

    var body: some View {
        NavigationSplitView {
            List(AppSection.allCases, selection: $selection) { section in
                Label(section.title, systemImage: section.systemImage)
                    .tag(section)
            }
            .navigationTitle("RiceFinance")
            .listStyle(.sidebar)
        } detail: {
            switch selection ?? .overview {
            case .overview:
                OverviewView()
            case .assets:
                AssetListView()
            case .analysis:
                AnalysisView()
            case .snapshots:
                SnapshotListView()
            case .ai:
                AIAnalysisView()
            }
        }
    }
}

private enum AppSection: String, CaseIterable, Identifiable {
    case overview
    case assets
    case analysis
    case snapshots
    case ai

    var id: String { rawValue }

    var title: String {
        switch self {
        case .overview: "首页"
        case .assets: "资产"
        case .analysis: "分析"
        case .snapshots: "快照"
        case .ai: "AI"
        }
    }

    var systemImage: String {
        switch self {
        case .overview: "house"
        case .assets: "list.bullet.rectangle"
        case .analysis: "chart.pie"
        case .snapshots: "calendar.badge.clock"
        case .ai: "sparkles"
        }
    }
}
#endif

#Preview {
    RootTabView()
}
