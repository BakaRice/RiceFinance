# CLAUDE.md — RiceFinance iOS

This file provides guidance to Claude Code when working with the iOS client.

## Quick Start

```bash
open RiceFinance.xcodeproj
# Build: Cmd+B in Xcode
# Run: Cmd+R, deploys to simulator or device
```

## Architecture

### Stack
SwiftUI + SwiftData + Charts (reserved) + URLSession

### Layered structure
```
RiceFinance/
├── Models/              # SwiftData @Model classes
│   ├── AssetAccount.swift
│   ├── LiabilityAccount.swift
│   ├── NetWorthSnapshot.swift
│   ├── SnapshotItem.swift
│   └── FinancialGoal.swift
├── Services/            # Business logic
│   ├── FinancialSummaryService.swift
│   ├── SnapshotService.swift
│   ├── RuleAnalysisService.swift
│   ├── AIAnalysisService.swift
│   └── Vault/           # Local JSON backup (not main sync)
├── Views/               # SwiftUI views
│   ├── RootTabView.swift
│   ├── Overview/        # Dashboard / net worth
│   ├── Assets/          # Asset & liability CRUD
│   ├── Analysis/        # Structure analysis
│   ├── Snapshots/       # Monthly snapshots
│   └── AI/              # AI review reports
└── RiceFinanceApp.swift # App entry point
```

### Data flow
```
SwiftData Model → Query → FinancialSummaryService → ViewModel → SwiftUI View
```

### Key services
| Service | Role |
|---------|------|
| `FinancialSummaryService` | Net worth calc, allocation stats, monthly change |
| `SnapshotService` | Freeze current state into `NetWorthSnapshot` + `SnapshotItem` |
| `RuleAnalysisService` | Local rule checks: cash too high, equity too low, concentration |
| `AIAnalysisService` | Structured AI summary (Mock in V0.1, real API later) |

Future services likely needed:

| Service | Role |
|---------|------|
| `SpendingImportService` | Normalize imported WeChat/Alipay/bank/CSV spending statements |
| `MonthlyReviewService` | Store AI questions, user answers, monthly summary, and next-month focus |
| `AgentContextService` | Build structured context for AI Agent review without sending unnecessary raw private data |

### Platform targets
- iPhone: `TabView` (5 tabs)
- iPad: `TabView` or `NavigationSplitView`
- Mac: `NavigationSplitView` via Mac Catalyst + sidebar

### Sync model (V0.2+)
SwiftData = local cache + offline edit queue. Backend = source of truth.
Sync flow: edit → write SwiftData → mark pending → POST /sync/push → update serverVersion

Long-term backend direction may shift from the current Java prototype to a TypeScript API / Agent service. Keep iOS network code contract-driven and avoid coupling UI logic to backend implementation details.

## Current state
V0.1 has SwiftUI page skeletons and local SwiftData models. Next product direction: Agent-style monthly review, spending import, and consumption behavior review.
