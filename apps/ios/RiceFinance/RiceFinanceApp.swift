//
//  RiceFinanceApp.swift
//  RiceFinance
//
//  Created by 谭文韬 on 2026/6/7.
//

import SwiftUI
import SwiftData

@main
struct RiceFinanceApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .modelContainer(for: [
            AssetAccount.self,
            LiabilityAccount.self,
            NetWorthSnapshot.self,
            SnapshotItem.self
        ])
    }
}
