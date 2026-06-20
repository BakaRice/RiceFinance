import Foundation

enum CurrencyFormatter {
    static func short(_ value: Decimal, currency: CurrencyCode = .cny) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencySymbol = currency.symbol
        formatter.maximumFractionDigits = 0
        formatter.minimumFractionDigits = 0
        return formatter.string(from: NSDecimalNumber(decimal: value)) ?? "\(currency.symbol)\(value)"
    }
}

enum PercentFormatter {
    static func short(_ value: Double) -> String {
        value.formatted(.percent.precision(.fractionLength(0...1)))
    }
}
