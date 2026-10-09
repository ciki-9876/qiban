import Foundation
import Capacitor
import Security
import CryptoKit
import UIKit
import WebKit
import UniformTypeIdentifiers

private struct QibanSession: Codable {
    let token: String
    let accountId: String
    let username: String
    let expires: Double
    var metadata: JSObject { ["accountId": accountId, "username": username, "expires": expires] }
}

private enum QibanError: Error { case invalid, unauthorized, accountChanged, storage, keychain(OSStatus), network }

@objc(QibanNativePlugin)
public class QibanNativePlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    public let identifier = "QibanNativePlugin"
    public let jsName = "QibanNative"
    public let pluginMethods: [CAPPluginMethod] = [
        "auth", "request", "logout", "cacheRead", "cacheWrite", "cacheDelete",
        "cacheLast", "cacheRemember", "cacheForget", "saveFile", "openExternal", "startupCheck"
    ].map { CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise) }
    private let origin = "https://81.70.181.205"
    private let queue = DispatchQueue(label: "io.github.ciki9876.qiban.vault")
    private let keychainService = "io.github.ciki9876.qiban.dev.vault"
    private var fileCall: CAPPluginCall?
    private var fileURL: URL?
    private var observers: [NSObjectProtocol] = []
    private lazy var client: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        config.httpCookieStorage = nil
        config.urlCache = nil
        config.timeoutIntervalForRequest = 90
        config.timeoutIntervalForResource = 100
        return URLSession(configuration: config, delegate: NoRedirectDelegate.shared, delegateQueue: nil)
    }()
    private let gets: Set<String> = ["/api/health", "/api/account", "/api/workspace", "/api/ai/config"]
    private let posts: Set<String> = ["/api/workspace", "/api/ai/config", "/api/ai/test", "/api/ai/plan", "/api/ai/feedback", "/api/ai/assist", "/api/ai/stage", "/api/ai/replace", "/api/ai/artifacts/upload", "/api/ai/artifacts/read"]

    public override func load() {
        observers.append(NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in self?.notifyListeners("lifecycle", data: ["active": true]) })
        observers.append(NotificationCenter.default.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: .main) { [weak self] _ in self?.notifyListeners("lifecycle", data: ["active": false]) })
    }
    deinit { observers.forEach(NotificationCenter.default.removeObserver) }
    public override func shouldOverrideLoad(_ action: WKNavigationAction) -> NSNumber? {
        guard let url = action.request.url, let local = bridge?.config.localURL else { return NSNumber(value: true) }
        if url.scheme == local.scheme, url.host == local.host, url.port == local.port, url.user == nil, url.password == nil { return nil }
        if action.navigationType == .linkActivated, ["https", "http"].contains(url.scheme?.lowercased() ?? ""), url.host != nil, url.user == nil, url.password == nil {
            UIApplication.shared.open(url, options: [:])
        }
        return NSNumber(value: true)
    }

    private func readSecret(_ name: String) throws -> Data? {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: keychainService, kSecAttrAccount as String: name, kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        var output: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &output)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess else { throw QibanError.keychain(status) }
        return output as? Data
    }
    private func writeSecret(_ name: String, data: Data?) throws {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: keychainService, kSecAttrAccount as String: name]
        if let data {
            let update = SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary)
            if update == errSecSuccess { return }
            guard update == errSecItemNotFound else { throw QibanError.keychain(update) }
            var add = query
            add[kSecValueData as String] = data
            add[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
            let added = SecItemAdd(add as CFDictionary, nil)
            guard added == errSecSuccess else { throw QibanError.keychain(added) }
        } else {
            let deletion = SecItemDelete(query as CFDictionary)
            guard deletion == errSecSuccess || deletion == errSecItemNotFound else { throw QibanError.keychain(deletion) }
        }
    }
    private func session() throws -> QibanSession? {
        guard let data = try readSecret("session") else { return nil }
        return try JSONDecoder().decode(QibanSession.self, from: data)
    }
    private func allowedAccount(_ id: String) throws {
        guard id.range(of: "^[a-f0-9]{32}$", options: .regularExpression) != nil,
              try session()?.accountId == id else { throw QibanError.unauthorized }
    }
    private func cacheDirectory() throws -> URL {
        let url = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true).appendingPathComponent("QibanEncrypted", isDirectory: true)
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true, attributes: [.protectionKey: FileProtectionType.complete])
        var excluded = url
        var values = URLResourceValues(); values.isExcludedFromBackup = true
        try excluded.setResourceValues(values)
        return url
    }
    private func cacheURL(_ id: String) throws -> URL { try cacheDirectory().appendingPathComponent("draft-" + id + ".sealed") }
    private func encryptionKey() throws -> SymmetricKey {
        if let data = try readSecret("draft-key") { return SymmetricKey(data: data) }
        let key = SymmetricKey(size: .bits256)
        try writeSecret("draft-key", data: key.withUnsafeBytes { Data($0) })
        return key
    }
    private func containsSecret(_ value: Any) -> Bool {
        if let object = value as? [String: Any] {
            let blocked: Set<String> = ["password", "passwordhash", "apikey", "token", "authorization", "csrf", "salt"]
            return object.contains { blocked.contains($0.key.lowercased()) || containsSecret($0.value) }
        }
        if let array = value as? [Any] { return array.contains(where: containsSecret) }
        return false
    }
    private func complete(_ call: CAPPluginCall, _ work: @escaping () throws -> JSObject) {
        queue.async {
            do { let output = try work(); DispatchQueue.main.async { call.resolve(output) } }
            catch { self.rejectStorage(call, error) }
        }
    }
    private func storageCode(_ error: Error) -> String {
        if case let QibanError.keychain(status) = error { return "NATIVE_KEYCHAIN_\(status)" }
        return "NATIVE_STORAGE"
    }
    private func rejectStorage(_ call: CAPPluginCall, _ error: Error) {
        if case QibanError.accountChanged = error { return DispatchQueue.main.async { call.reject("当前账号已变化，请回到登录继续。", "ACCOUNT_CHANGED") } }
        let code = storageCode(error)
        DispatchQueue.main.async { call.reject("本机安全存储暂时无法完成操作（\(code)）。", code) }
    }
    private func rejectChangedRequest(_ call: CAPPluginCall) {
        DispatchQueue.main.async { call.resolve(["status": 409, "data": ["code": "ACCOUNT_CHANGED", "message": "当前账号已变化，请回到登录继续。"]]) }
    }
    @objc public func startupCheck(_ call: CAPPluginCall) {
        #if targetEnvironment(simulator)
        guard ProcessInfo.processInfo.arguments.contains("--qiban-smoke") else { return call.resolve(["simulator": true, "enabled": false]) }
        guard let url = bridge?.webView?.url, let local = bridge?.config.localURL,
              url.scheme == local.scheme, url.host == local.host, url.path == "/login.html",
              call.getString("page") == "login", let metrics = call.getObject("metrics") else { return call.reject("匿名登录页面尚未就绪。", "STARTUP_PAGE_NOT_READY") }
        queue.async {
            let name = "simulator-check-" + UUID().uuidString
            var temporary: URL?
            defer { try? self.writeSecret(name, data: nil); if let temporary { try? FileManager.default.removeItem(at: temporary) } }
            do {
                var safeMetrics: JSObject = [:]
                for name in ["width", "height"] {
                    guard let number = metrics[name] as? NSNumber, number.doubleValue.isFinite, number.doubleValue > 0, number.doubleValue < 8192 else { throw QibanError.invalid }
                    safeMetrics[name] = number
                }
                for name in ["username", "password", "submit"] {
                    guard let rectangle = metrics[name] as? JSObject else { throw QibanError.invalid }
                    var safeRectangle: JSObject = [:]
                    for coordinate in ["left", "top", "width", "height"] {
                        guard let number = rectangle[coordinate] as? NSNumber, number.doubleValue.isFinite else { throw QibanError.invalid }
                        safeRectangle[coordinate] = number
                    }
                    safeMetrics[name] = safeRectangle
                }
                // Check only whether a session exists; never return or log a session value.
                let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: self.keychainService, kSecAttrAccount as String: "session"]
                let status = SecItemCopyMatching(query as CFDictionary, nil)
                guard status == errSecItemNotFound else { if status != errSecSuccess { throw QibanError.keychain(status) }; throw QibanError.unauthorized }
                let key = SymmetricKey(size: .bits256), keyData = key.withUnsafeBytes { Data($0) }
                try self.writeSecret(name, data: keyData)
                guard try self.readSecret(name) == keyData else { throw QibanError.storage }
                let plain = Data("Qiban Simulator isolated storage fixture".utf8), aad = Data(name.utf8)
                guard let encrypted = try AES.GCM.seal(plain, using: key, authenticating: aad).combined else { throw QibanError.storage }
                let file = try self.cacheDirectory().appendingPathComponent(name + ".sealed"); temporary = file
                try encrypted.write(to: file, options: [.atomic, .completeFileProtection])
                guard try AES.GCM.open(AES.GCM.SealedBox(combined: Data(contentsOf: file)), using: key, authenticating: aad) == plain else { throw QibanError.storage }
                try self.writeSecret(name, data: nil)
                guard try self.readSecret(name) == nil else { throw QibanError.storage }
                let record: JSObject = ["schema": 1, "page": "login", "ready": true, "anonymous": true,
                    "checks": ["keychainWriteReadDelete": true, "encryptedDraftWriteRead": true] as JSObject,
                    "metrics": safeMetrics, "checkedAt": Date().timeIntervalSince1970 * 1000]
                try self.writeStartupRecord(record)
                DispatchQueue.main.async { call.resolve(["ok": true, "simulator": true, "enabled": true]) }
            } catch {
                try? self.writeStartupRecord(["schema": 1, "page": "login", "ready": false, "errorCode": self.storageCode(error), "checkedAt": Date().timeIntervalSince1970 * 1000])
                self.rejectStorage(call, error)
            }
        }
        #else
        call.resolve(["simulator": false])
        #endif
    }
    private func writeStartupRecord(_ record: JSObject) throws {
        let root = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true).appendingPathComponent("QibanSmoke", isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true, attributes: [.protectionKey: FileProtectionType.complete])
        try JSONSerialization.data(withJSONObject: record).write(to: root.appendingPathComponent("readiness.json"), options: [.atomic, .completeFileProtection])
    }
    private func fetch(path: String, method: String, payload: JSObject?, token: String?, completion: @escaping (Result<(Int, JSObject), Error>) -> Void) {
        guard let url = URL(string: origin + path) else { return completion(.failure(QibanError.invalid)) }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token { request.setValue("Bearer " + token, forHTTPHeaderField: "Authorization") }
        if method == "POST" {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            do {
                let body = try JSONSerialization.data(withJSONObject: payload ?? [:])
                guard body.count <= 12 * 1024 * 1024 else { return completion(.failure(QibanError.invalid)) }
                request.httpBody = body
            }
            catch { return completion(.failure(QibanError.invalid)) }
        }
        client.dataTask(with: request) { data, response, error in
            guard error == nil, let http = response as? HTTPURLResponse, let data, data.count <= 16 * 1024 * 1024,
                  let object = try? JSONSerialization.jsonObject(with: data) as? JSObject else { return completion(.failure(QibanError.network)) }
            completion(.success((http.statusCode, object)))
        }.resume()
    }
    @objc public func auth(_ call: CAPPluginCall) {
        guard let kind = call.getString("kind"), ["login", "register"].contains(kind), let username = call.getString("username"), let password = call.getString("password") else { return call.reject("登录内容不完整。") }
        fetch(path: "/api/native/auth/" + kind, method: "POST", payload: ["username": username, "password": password], token: nil) { [weak self] result in
            guard let self else { return }
            switch result {
            case let .success((status, data)):
                guard status == 200, let token = data["token"] as? String, token.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil, let accountId = data["accountId"] as? String, accountId.range(of: "^[a-f0-9]{32}$", options: .regularExpression) != nil, let name = data["username"] as? String, let expires = data["expires"] as? Double, expires.isFinite else {
                    return DispatchQueue.main.async { call.reject(data["message"] as? String ?? "无法登录，请稍后重试。", "HTTP_\(status)") }
                }
                let value = QibanSession(token: token, accountId: accountId, username: name, expires: expires)
                self.complete(call) { try self.writeSecret("session", data: JSONEncoder().encode(value)); return value.metadata }
            case .failure: DispatchQueue.main.async { call.reject("无法连接栖伴，请检查网络。", "NETWORK") }
            }
        }
    }
    @objc public func request(_ call: CAPPluginCall) {
        guard let path = call.getString("path"), let method = call.getString("method"), (method == "GET" && gets.contains(path)) || (method == "POST" && posts.contains(path)) else { return call.reject("不支持的栖伴接口。", "INVALID_PATH") }
        let expected = call.getString("expectedAccountId"), bootstrap = path == "/api/account" || path == "/api/health"
        queue.async {
            do {
                guard let session = try self.session(), session.expires > Date().timeIntervalSince1970 * 1000 else {
                    return DispatchQueue.main.async { call.resolve(["status": 401, "data": ["message": "请重新登录栖伴。"]]) }
                }
                guard (bootstrap || expected != nil), expected == nil || expected == session.accountId else { return self.rejectChangedRequest(call) }
                self.fetch(path: path.replacingOccurrences(of: "/api/", with: "/api/native/", options: .anchored), method: method, payload: call.getObject("body"), token: session.token) { result in
                    self.queue.async {
                        do {
                            guard let current = try self.session(), current.token == session.token else { return self.rejectChangedRequest(call) }
                            DispatchQueue.main.async {
                                switch result {
                                case let .success((status, data)): call.resolve(["status": status, "data": data])
                                case .failure: call.reject("无法连接栖伴，请检查网络。", "NETWORK")
                                }
                            }
                        } catch { self.rejectStorage(call, error) }
                    }
                }
            } catch { self.rejectStorage(call, error) }
        }
    }
    @objc public func logout(_ call: CAPPluginCall) {
        let expected = call.getString("expectedAccountId")
        queue.async {
            do {
                guard let session = try self.session() else { return DispatchQueue.main.async { call.resolve(["ok": true]) } }
                guard expected == session.accountId else { throw QibanError.accountChanged }
                self.fetch(path: "/api/native/auth/logout", method: "POST", payload: [:], token: session.token) { result in
                    // Do not claim server-side revocation when disconnected; retain the session for retry.
                    switch result {
                    case let .success((status, _)) where status == 200 || status == 401:
                        self.complete(call) {
                            guard let current = try self.session(), current.token == session.token else { throw QibanError.accountChanged }
                            let url = try self.cacheURL(session.accountId)
                            if FileManager.default.fileExists(atPath: url.path) { try FileManager.default.removeItem(at: url) }
                            try self.writeSecret("last-account", data: nil)
                            try self.writeSecret("session", data: nil)
                            return ["ok": true]
                        }
                    default: DispatchQueue.main.async { call.reject("未能退出云端会话，请联网后重试。", "NETWORK") }
                    }
                }
            } catch { self.rejectStorage(call, error) }
        }
    }
    @objc public func cacheRead(_ call: CAPPluginCall) {
        guard let id = call.getString("accountId") else { return call.reject("缺少账号编号。") }
        complete(call) {
            try self.allowedAccount(id)
            let url = try self.cacheURL(id)
            guard FileManager.default.fileExists(atPath: url.path) else { return ["record": NSNull()] }
            let data = try Data(contentsOf: url)
            let plain = try AES.GCM.open(AES.GCM.SealedBox(combined: data), using: self.encryptionKey(), authenticating: Data(("draft-" + id).utf8))
            guard let record = try JSONSerialization.jsonObject(with: plain) as? JSObject else { throw QibanError.storage }
            return ["record": record]
        }
    }
    @objc public func cacheWrite(_ call: CAPPluginCall) {
        guard let id = call.getString("accountId"), let record = call.getObject("record"), !containsSecret(record) else { return call.reject("草稿包含不可保存的登录或配置字段。") }
        complete(call) {
            try self.allowedAccount(id)
            let plain = try JSONSerialization.data(withJSONObject: record)
            guard plain.count <= 12 * 1024 * 1024, let sealed = try AES.GCM.seal(plain, using: self.encryptionKey(), authenticating: Data(("draft-" + id).utf8)).combined else { throw QibanError.invalid }
            try sealed.write(to: self.cacheURL(id), options: [.atomic, .completeFileProtection])
            return ["ok": true]
        }
    }
    @objc public func cacheDelete(_ call: CAPPluginCall) {
        guard let id = call.getString("accountId"), id.range(of: "^[a-f0-9]{32}$", options: .regularExpression) != nil else { return call.reject("账号编号无效。") }
        complete(call) {
            let url = try self.cacheURL(id)
            if FileManager.default.fileExists(atPath: url.path) { try self.allowedAccount(id); try FileManager.default.removeItem(at: url) }
            return ["ok": true]
        }
    }
    @objc public func cacheLast(_ call: CAPPluginCall) {
        complete(call) {
            guard let data = try self.readSecret("last-account"), let record = try JSONSerialization.jsonObject(with: data) as? JSObject else { return ["record": NSNull()] }
            return ["record": record]
        }
    }
    @objc public func cacheRemember(_ call: CAPPluginCall) {
        guard let id = call.getString("accountId") else { return call.reject("缺少账号编号。") }
        complete(call) {
            try self.allowedAccount(id)
            guard let session = try self.session() else { throw QibanError.unauthorized }
            try self.writeSecret("last-account", data: JSONSerialization.data(withJSONObject: session.metadata))
            return ["ok": true]
        }
    }
    @objc public func cacheForget(_ call: CAPPluginCall) { complete(call) { try self.writeSecret("last-account", data: nil); return ["ok": true] } }
    @objc public func openExternal(_ call: CAPPluginCall) {
        guard let raw = call.getString("url"), let url = URL(string: raw), ["https", "http"].contains(url.scheme?.lowercased() ?? ""), url.host != nil, url.user == nil, url.password == nil else { return call.reject("外部链接无效。") }
        DispatchQueue.main.async { UIApplication.shared.open(url, options: [:]) { ok in ok ? call.resolve(["ok": true]) : call.reject("无法打开外部链接。") } }
    }
    @objc public func saveFile(_ call: CAPPluginCall) {
        guard fileCall == nil else { return call.reject("请先完成当前文件操作。") }
        guard let name = call.getString("name"), !name.isEmpty, name.count <= 180, !name.contains("/"), !name.contains("\\"), let raw = call.getString("base64"), let data = Data(base64Encoded: raw), data.count <= 16 * 1024 * 1024 else { return call.reject("文件内容无效或过大。") }
        do {
            let dir = FileManager.default.temporaryDirectory.appendingPathComponent("qiban-export-" + UUID().uuidString, isDirectory: true)
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true, attributes: [.protectionKey: FileProtectionType.complete])
            let url = dir.appendingPathComponent(name)
            try data.write(to: url, options: [.atomic, .completeFileProtection])
            fileCall = call; fileURL = url
            DispatchQueue.main.async {
                guard let controller = self.bridge?.viewController else { return self.finishFile(false) }
                if call.getBool("share") == true {
                    let sheet = UIActivityViewController(activityItems: [url], applicationActivities: nil)
                    sheet.popoverPresentationController?.sourceView = controller.view
                    sheet.popoverPresentationController?.sourceRect = CGRect(x: controller.view.bounds.midX, y: controller.view.bounds.midY, width: 1, height: 1)
                    sheet.completionWithItemsHandler = { _, completed, _, _ in self.finishFile(completed) }
                    controller.present(sheet, animated: true)
                } else {
                    let picker = UIDocumentPickerViewController(forExporting: [url], asCopy: true)
                    picker.delegate = self
                    controller.present(picker, animated: true)
                }
            }
        } catch { call.reject("无法准备导出文件。") }
    }
    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) { finishFile(!urls.isEmpty) }
    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) { finishFile(false) }
    private func finishFile(_ ok: Bool) {
        fileCall?.resolve(["ok": ok])
        if let url = fileURL { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }
        fileCall = nil; fileURL = nil
    }
}

private final class NoRedirectDelegate: NSObject, URLSessionTaskDelegate {
    static let shared = NoRedirectDelegate()
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
