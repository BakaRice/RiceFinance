import Foundation
import SwiftData

@Model
final class AssetAccount {
    @Attribute(.unique) var uid: String
    var name: String
    var typeRawValue: String
    var platform: String
    var currencyRawValue: String
    var amount: Decimal
    var shareCount: Decimal?
    var riskRawValue: String
    var liquidityRawValue: String
    var note: String
    var updatedAt: Date

    init(
        uid: String = UUID().uuidString,
        name: String,
        type: AssetType,
        platform: String = "",
        currency: CurrencyCode = .cny,
        amount: Decimal,
        shareCount: Decimal? = nil,
        risk: RiskLevel,
        liquidity: LiquidityLevel,
        note: String = "",
        updatedAt: Date = .now
    ) {
        self.uid = uid
        self.name = name
        self.typeRawValue = type.rawValue
        self.platform = platform
        self.currencyRawValue = currency.rawValue
        self.amount = amount
        self.shareCount = shareCount
        self.riskRawValue = risk.rawValue
        self.liquidityRawValue = liquidity.rawValue
        self.note = note
        self.updatedAt = updatedAt
    }

    var type: AssetType {
        get { AssetType(rawValue: typeRawValue) ?? .other }
        set { typeRawValue = newValue.rawValue }
    }

    var currency: CurrencyCode {
        get { CurrencyCode(rawValue: currencyRawValue) ?? .cny }
        set { currencyRawValue = newValue.rawValue }
    }

    var risk: RiskLevel {
        get { RiskLevel(rawValue: riskRawValue) ?? .medium }
        set { riskRawValue = newValue.rawValue }
    }

    var liquidity: LiquidityLevel {
        get { LiquidityLevel(rawValue: liquidityRawValue) ?? .medium }
        set { liquidityRawValue = newValue.rawValue }
    }
}
