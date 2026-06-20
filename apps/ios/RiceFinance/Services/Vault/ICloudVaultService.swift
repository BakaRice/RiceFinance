import Foundation

enum VaultDirectory: String, CaseIterable {
    case assets
    case liabilities
    case snapshots
    case reports
    case attachments
    case backups
}

struct VaultManifest: Codable {
    var schema: String
    var version: Int
    var createdAt: Date
    var updatedAt: Date
    var baseCurrency: String
    var appVersion: String

    static func fresh() -> VaultManifest {
        VaultManifest(
            schema: "ricefinance.vault",
            version: 1,
            createdAt: .now,
            updatedAt: .now,
            baseCurrency: CurrencyCode.cny.rawValue,
            appVersion: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        )
    }
}

enum ICloudVaultService {
    static let vaultFolderName = "Vault"
    static let manifestFilename = "manifest.json"

    static func vaultURL() throws -> URL {
        let rootURL = try rootDocumentsURL()
        return rootURL.appendingPathComponent(vaultFolderName, isDirectory: true)
    }

    @discardableResult
    static func ensureVault() throws -> URL {
        let vaultURL = try vaultURL()
        let fileManager = FileManager.default

        try fileManager.createDirectory(at: vaultURL, withIntermediateDirectories: true, attributes: nil)
        try VaultDirectory.allCases.forEach { directory in
            try fileManager.createDirectory(
                at: directoryURL(directory, in: vaultURL),
                withIntermediateDirectories: true,
                attributes: nil
            )
        }

        let manifestURL = vaultURL.appendingPathComponent(manifestFilename)
        if !fileManager.fileExists(atPath: manifestURL.path) {
            try writeJSON(VaultManifest.fresh(), to: manifestURL)
        }

        return vaultURL
    }

    static func recordURL(directory: VaultDirectory, filename: String) throws -> URL {
        try ensureVault()
            .appendingPathComponent(directory.rawValue, isDirectory: true)
            .appendingPathComponent(filename)
    }

    static func recordURLs(in directory: VaultDirectory) throws -> [URL] {
        let directoryURL = try ensureVault().appendingPathComponent(directory.rawValue, isDirectory: true)
        return try FileManager.default
            .contentsOfDirectory(at: directoryURL, includingPropertiesForKeys: nil)
            .filter { $0.pathExtension == "json" }
            .sorted { $0.lastPathComponent < $1.lastPathComponent }
    }

    static func writeJSON<T: Encodable>(_ value: T, to url: URL) throws {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try encoder.encode(value)
        try data.write(to: url, options: [.atomic])
        try touchManifest()
    }

    static func writeText(_ text: String, to url: URL) throws {
        try text.write(to: url, atomically: true, encoding: .utf8)
        try touchManifest()
    }

    static func readJSON<T: Decodable>(_ type: T.Type, from url: URL) throws -> T {
        let data = try Data(contentsOf: url)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(type, from: data)
    }

    static func removeRecord(directory: VaultDirectory, filename: String) throws {
        let url = try recordURL(directory: directory, filename: filename)
        guard FileManager.default.fileExists(atPath: url.path) else { return }
        try FileManager.default.removeItem(at: url)
        try touchManifest()
    }

    static var locationDescription: String {
        if FileManager.default.url(forUbiquityContainerIdentifier: nil) != nil {
            return "iCloud Drive/RiceFinance/Vault"
        }
        return "本机 Documents/RiceFinance/Vault"
    }

    private static func rootDocumentsURL() throws -> URL {
        if let ubiquityURL = FileManager.default.url(forUbiquityContainerIdentifier: nil) {
            return ubiquityURL.appendingPathComponent("Documents", isDirectory: true)
        }

        let appDocumentsURL = try FileManager.default.url(
            for: .documentDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        return appDocumentsURL.appendingPathComponent("RiceFinance", isDirectory: true)
    }

    private static func directoryURL(_ directory: VaultDirectory, in vaultURL: URL) -> URL {
        vaultURL.appendingPathComponent(directory.rawValue, isDirectory: true)
    }

    private static func touchManifest() throws {
        let manifestURL = try vaultURL().appendingPathComponent(manifestFilename)
        guard FileManager.default.fileExists(atPath: manifestURL.path) else { return }

        var manifest = try readJSON(VaultManifest.self, from: manifestURL)
        manifest.updatedAt = .now

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        try encoder.encode(manifest).write(to: manifestURL, options: [.atomic])
    }
}
