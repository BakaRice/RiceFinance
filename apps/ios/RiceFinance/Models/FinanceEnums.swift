import Foundation
import SwiftUI

enum AssetType: String, CaseIterable, Codable, Identifiable {
    case cash
    case deposit
    case fixedIncome
    case fund
    case stock
    case commodity
    case foreignCurrency
    case other

    var id: String { rawValue }

    var title: String {
        switch self {
        case .cash: "现金"
        case .deposit: "存款"
        case .fixedIncome: "固定收益"
        case .fund: "基金"
        case .stock: "股票"
        case .commodity: "商品"
        case .foreignCurrency: "外币"
        case .other: "其他"
        }
    }

    var symbol: String {
        switch self {
        case .cash: "banknote"
        case .deposit: "building.columns"
        case .fixedIncome: "chart.line.uptrend.xyaxis"
        case .fund: "chart.pie"
        case .stock: "candlestickchart"
        case .commodity: "shippingbox"
        case .foreignCurrency: "dollarsign.circle"
        case .other: "tray.full"
        }
    }

    var color: Color {
        switch self {
        case .cash: .mint
        case .deposit: .blue
        case .fixedIncome: .teal
        case .fund: .indigo
        case .stock: .red
        case .commodity: .orange
        case .foreignCurrency: .cyan
        case .other: .gray
        }
    }
}

enum LiabilityType: String, CaseIterable, Codable, Identifiable {
    case creditCard
    case mortgage
    case consumerLoan
    case personalLoan
    case other

    var id: String { rawValue }

    var title: String {
        switch self {
        case .creditCard: "信用卡"
        case .mortgage: "房贷"
        case .consumerLoan: "消费贷"
        case .personalLoan: "个人借款"
        case .other: "其他"
        }
    }
}

enum RiskLevel: String, CaseIterable, Codable, Identifiable {
    case low
    case medium
    case high

    var id: String { rawValue }

    var title: String {
        switch self {
        case .low: "低风险"
        case .medium: "中风险"
        case .high: "高风险"
        }
    }

    var color: Color {
        switch self {
        case .low: .green
        case .medium: .orange
        case .high: .red
        }
    }
}

enum LiquidityLevel: String, CaseIterable, Codable, Identifiable {
    case high
    case medium
    case low

    var id: String { rawValue }

    var title: String {
        switch self {
        case .high: "高流动性"
        case .medium: "中流动性"
        case .low: "低流动性"
        }
    }

    var color: Color {
        switch self {
        case .high: .mint
        case .medium: .blue
        case .low: .purple
        }
    }
}

enum CurrencyCode: String, CaseIterable, Codable, Identifiable {
    case cny = "CNY"
    case usd = "USD"
    case hkd = "HKD"
    case eur = "EUR"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .cny: "人民币"
        case .usd: "美元"
        case .hkd: "港币"
        case .eur: "欧元"
        }
    }

    var symbol: String {
        switch self {
        case .cny: "¥"
        case .usd: "$"
        case .hkd: "HK$"
        case .eur: "€"
        }
    }
}
