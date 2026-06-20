import Foundation
import SwiftData

@Model
final class NetWorthSnapshot {
    @Attribute(.unique) var uid: String
    var date: Date
    var totalAssets: Decimal
    var totalLiabilities: Decimal
    var netWorth: Decimal
    var currencyRawValue: String
    var note: String
    @Relationship(deleteRule: .cascade, inverse: \SnapshotItem.snapshot)
    var items: [SnapshotItem]

    init(
        uid: String = UUID().uuidString,
        date: Date = .now,
        totalAssets: Decimal,
        totalLiabilities: Decimal,
        netWorth: Decimal,
        currency: CurrencyCode = .cny,
        note: String = "",
        items: [SnapshotItem] = []
    ) {
        self.uid = uid
        self.date = date
        self.totalAssets = totalAssets
        self.totalLiabilities = totalLiabilities
        self.netWorth = netWorth
        self.currencyRawValue = currency.rawValue
        self.note = note
        self.items = items
    }

    var currency: CurrencyCode {
        get { CurrencyCode(rawValue: currencyRawValue) ?? .cny }
        set { currencyRawValue = newValue.rawValue }
    }
}
