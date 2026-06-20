import Foundation
import SwiftData

@Model
final class LiabilityAccount {
    @Attribute(.unique) var uid: String
    var name: String
    var typeRawValue: String
    var currencyRawValue: String
    var amount: Decimal
    var dueDate: Date?
    var note: String
    var updatedAt: Date

    init(
        uid: String = UUID().uuidString,
        name: String,
        type: LiabilityType,
        currency: CurrencyCode = .cny,
        amount: Decimal,
        dueDate: Date? = nil,
        note: String = "",
        updatedAt: Date = .now
    ) {
        self.uid = uid
        self.name = name
        self.typeRawValue = type.rawValue
        self.currencyRawValue = currency.rawValue
        self.amount = amount
        self.dueDate = dueDate
        self.note = note
        self.updatedAt = updatedAt
    }

    var type: LiabilityType {
        get { LiabilityType(rawValue: typeRawValue) ?? .other }
        set { typeRawValue = newValue.rawValue }
    }

    var currency: CurrencyCode {
        get { CurrencyCode(rawValue: currencyRawValue) ?? .cny }
        set { currencyRawValue = newValue.rawValue }
    }
}
