import Foundation
import SwiftData

@Model
final class SnapshotItem {
    @Attribute(.unique) var uid: String
    var sourceName: String
    var amount: Decimal
    var category: String
    var riskRawValue: String
    var liquidityRawValue: String
    var isLiability: Bool
    var snapshot: NetWorthSnapshot?

    init(
        uid: String = UUID().uuidString,
        sourceName: String,
        amount: Decimal,
        category: String,
        risk: RiskLevel = .low,
        liquidity: LiquidityLevel = .high,
        isLiability: Bool = false,
        snapshot: NetWorthSnapshot? = nil
    ) {
        self.uid = uid
        self.sourceName = sourceName
        self.amount = amount
        self.category = category
        self.riskRawValue = risk.rawValue
        self.liquidityRawValue = liquidity.rawValue
        self.isLiability = isLiability
        self.snapshot = snapshot
    }

    var risk: RiskLevel {
        get { RiskLevel(rawValue: riskRawValue) ?? .low }
        set { riskRawValue = newValue.rawValue }
    }

    var liquidity: LiquidityLevel {
        get { LiquidityLevel(rawValue: liquidityRawValue) ?? .high }
        set { liquidityRawValue = newValue.rawValue }
    }
}
