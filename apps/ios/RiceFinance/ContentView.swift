import SwiftData
import SwiftUI

struct ContentView: View {
    @Environment(\.modelContext) private var modelContext
    @State private var vaultSyncMessage: String?
    @State private var showingVaultSyncMessage = false

    var body: some View {
        RootTabView()
            .task {
                do {
                    try VaultSyncService.bootstrapCache(from: modelContext)
                } catch {
                    vaultSyncMessage = "文件库同步失败：\(error.localizedDescription)"
                    showingVaultSyncMessage = true
                }
            }
            .alert(vaultSyncMessage ?? "", isPresented: $showingVaultSyncMessage) {
                Button("好", role: .cancel) {}
            }
    }
}

#Preview {
    ContentView()
}
