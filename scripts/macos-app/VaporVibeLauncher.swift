import AppKit
import Darwin
import Foundation

private let defaultServerURL = URL(string: "http://127.0.0.1:3000/")!
private let adminConsolePathComponent = "vaporvibe"
private let logDirectory = FileManager.default.homeDirectoryForCurrentUser
  .appendingPathComponent("Library/Logs/VaporVibe", isDirectory: true)
private let logFileURL = logDirectory.appendingPathComponent("vaporvibe.log", isDirectory: false)
private let terminationGracePeriod: TimeInterval = 3
private let monitoredSignals: [Int32] = [SIGTERM, SIGINT, SIGQUIT, SIGHUP]

private func configureLoggingPipe(_ pipe: Pipe, onData: @escaping (Data) -> Void) -> FileHandle? {
  var logHandle: FileHandle?

  do {
    try FileManager.default.createDirectory(at: logDirectory, withIntermediateDirectories: true, attributes: nil)
    if !FileManager.default.fileExists(atPath: logFileURL.path) {
      FileManager.default.createFile(atPath: logFileURL.path, contents: nil, attributes: nil)
    }
    logHandle = try FileHandle(forWritingTo: logFileURL)
    try logHandle?.seekToEnd()
  } catch {
    fputs("VaporVibe: unable to configure logfile: \(error)\n", stderr)
  }

  let queue = DispatchQueue(label: "vaporvibe.log-writer")
  pipe.fileHandleForReading.readabilityHandler = { handle in
    let data = handle.availableData
    guard !data.isEmpty else {
      handle.readabilityHandler = nil
      return
    }

    onData(data)

    if let logHandle {
      queue.async {
        do {
          try logHandle.write(contentsOf: data)
        } catch {
          fputs("VaporVibe: failed to write logs: \(error)\n", stderr)
        }
      }
    }
  }

  return logHandle
}

private final class AnsiEscapeParser {
  private let regularFont = NSFont.monospacedSystemFont(ofSize: 12, weight: .regular)
  private let boldFont = NSFont.monospacedSystemFont(ofSize: 12, weight: .semibold)
  private var buffer = ""
  private var currentColor: NSColor = .textColor
  private var isBold = false

  func parse(_ string: String) -> NSAttributedString {
    buffer.append(string)
    let output = NSMutableAttributedString()

    var index = buffer.startIndex
    var textStart = index

    while index < buffer.endIndex {
      let character = buffer[index]
      if character == "\u{001B}" {
        let escapeStart = index

        if textStart < index {
          let chunk = String(buffer[textStart..<index])
          output.append(attributedChunk(from: chunk))
        }

        index = buffer.index(after: index)
        guard index < buffer.endIndex else {
          buffer = String(buffer[escapeStart...])
          return output
        }

        guard buffer[index] == "[" else {
          index = buffer.index(after: index)
          textStart = index
          continue
        }

        var searchIndex = buffer.index(after: index)
        var sequenceEnd: String.Index?

        while searchIndex < buffer.endIndex {
          let char = buffer[searchIndex]
          if char.isLetter {
            sequenceEnd = searchIndex
            break
          }
          searchIndex = buffer.index(after: searchIndex)
        }

        guard let sequenceEnd else {
          buffer = String(buffer[escapeStart...])
          return output
        }

        let command = buffer[sequenceEnd]
        let codesString = buffer[buffer.index(after: index)..<sequenceEnd]
        if command == "m" {
          let codes = codesString.split(separator: ";").compactMap { Int($0) }
          apply(codes: codes)
        }

        index = buffer.index(after: sequenceEnd)
        textStart = index
      } else {
        index = buffer.index(after: index)
      }
    }

    if textStart < buffer.endIndex {
      let chunk = String(buffer[textStart..<buffer.endIndex])
      output.append(attributedChunk(from: chunk))
      buffer.removeAll(keepingCapacity: true)
    } else {
      buffer.removeAll(keepingCapacity: true)
    }

    return output
  }

  private func attributedChunk(from string: String) -> NSAttributedString {
    let normalized = string
      .replacingOccurrences(of: "\r\n", with: "\n")
      .replacingOccurrences(of: "\r", with: "\n")
    var attributes: [NSAttributedString.Key: Any] = [:]
    attributes[.font] = isBold ? boldFont : regularFont
    attributes[.foregroundColor] = currentColor
    return NSAttributedString(string: normalized, attributes: attributes)
  }

  private func apply(codes: [Int]) {
    if codes.isEmpty {
      reset()
      return
    }

    for code in codes {
      switch code {
      case 0:
        reset()
      case 1:
        isBold = true
      case 22:
        isBold = false
      case 30, 31, 32, 33, 34, 35, 36, 37:
        currentColor = standardColor(for: code)
      case 90, 91, 92, 93, 94, 95, 96, 97:
        currentColor = brightColor(for: code)
      case 39:
        currentColor = .textColor
      default:
        continue
      }
    }
  }

  private func reset() {
    currentColor = .textColor
    isBold = false
  }

  private func standardColor(for code: Int) -> NSColor {
    switch code {
    case 30: return .labelColor
    case 31: return .systemRed
    case 32: return .systemGreen
    case 33: return .systemOrange
    case 34: return .systemBlue
    case 35: return .systemPink
    case 36: return .systemTeal
    case 37: return .textColor
    default: return .textColor
    }
  }

  private func brightColor(for code: Int) -> NSColor {
    switch code {
    case 90: return .secondaryLabelColor
    case 91: return .systemRed
    case 92: return .systemGreen
    case 93: return .systemYellow
    case 94: return .systemBlue
    case 95: return .systemPurple
    case 96: return .systemTeal
    case 97: return .white
    default: return .textColor
    }
  }
}

private final class LogWindowController: NSWindowController, NSWindowDelegate {
  private let textView: NSTextView

  init() {
    let contentRect = NSRect(x: 0, y: 0, width: 720, height: 420)
    let window = NSWindow(
      contentRect: contentRect,
      styleMask: [.titled, .closable, .miniaturizable, .resizable],
      backing: .buffered,
      defer: false
    )
    window.title = "VaporVibe Logs"
    window.isReleasedWhenClosed = false
    window.setFrameAutosaveName("VaporVibeLogsWindow")

    let scrollView = NSScrollView(frame: contentRect)
    scrollView.hasVerticalScroller = true
    scrollView.autoresizingMask = [.width, .height]

    let textView = NSTextView(frame: scrollView.bounds)
    textView.isEditable = false
    textView.isSelectable = true
    textView.font = NSFont.monospacedSystemFont(ofSize: 12, weight: .regular)
    textView.textColor = .textColor
    textView.backgroundColor = .textBackgroundColor
    textView.autoresizingMask = [.width, .height]
    textView.textContainerInset = NSSize(width: 8, height: 8)

    scrollView.documentView = textView
    window.contentView?.addSubview(scrollView)

    self.textView = textView

    super.init(window: window)

    window.delegate = self
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  func append(_ attributedText: NSAttributedString) {
    guard let storage = textView.textStorage else { return }
    storage.beginEditing()
    storage.append(attributedText)
    storage.endEditing()
    textView.scrollToEndOfDocument(nil)
  }

  func showLogWindow() {
    showWindow(nil)
    window?.makeKeyAndOrderFront(nil)
    NSApp.activate(ignoringOtherApps: true)
  }
}

final class LauncherDelegate: NSObject, NSApplicationDelegate {
  private var child: Process?
  private var outputPipe: Pipe?
  private var logHandle: FileHandle?
  private var isTerminatingChild = false
  private var isRestartingChild = false
  private var launchArguments = Array(CommandLine.arguments.dropFirst())
  private var launchEnvironment = ProcessInfo.processInfo.environment
  private var serverBinaryURL: URL?
  private let logWindowController = LogWindowController()
  private let ansiParser = AnsiEscapeParser()
  private let childTerminationQueue = DispatchQueue(label: "vaporvibe.launcher.child-termination")
  private var signalSources: [DispatchSourceSignal] = []
  private let serverURLQueue = DispatchQueue(label: "vaporvibe.launcher.server-url", attributes: .concurrent)
  private var resolvedServerURLValue = defaultServerURL
  private var pendingLogLineFragment = ""
  private let urlDetector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue)

  private func currentServerURL() -> URL {
    serverURLQueue.sync { resolvedServerURLValue }
  }

  private func setResolvedServerURL(_ url: URL, synchronous: Bool = false) {
    let work = {
      self.resolvedServerURLValue = url
    }

    if synchronous {
      serverURLQueue.sync(flags: .barrier, execute: work)
    } else {
      serverURLQueue.async(flags: .barrier, execute: work)
    }
  }

  private func updateServerURLIfNeeded(_ url: URL) {
    let current = currentServerURL()
    if current.absoluteString == url.absoluteString { return }
    setResolvedServerURL(url)
  }

  private func processLogChunkForURLDetection(_ chunk: String) {
    guard !chunk.isEmpty else { return }

    pendingLogLineFragment.append(chunk)
    pendingLogLineFragment = pendingLogLineFragment
      .replacingOccurrences(of: "\r\n", with: "\n")
      .replacingOccurrences(of: "\r", with: "\n")

    let components = pendingLogLineFragment
      .split(separator: "\n", omittingEmptySubsequences: false)
      .map(String.init)

    guard !components.isEmpty else { return }

    let endsWithNewline = pendingLogLineFragment.hasSuffix("\n")
    let linesToProcess = endsWithNewline ? components : Array(components.dropLast())
    pendingLogLineFragment = endsWithNewline ? "" : (components.last ?? "")

    for line in linesToProcess where !line.isEmpty {
      let sanitizedLine = stripANSIEscapeSequences(from: line)
      guard !sanitizedLine.isEmpty else { continue }
      if let url = extractServerURL(fromLogLine: sanitizedLine) {
        updateServerURLIfNeeded(url)
      }
    }

    if pendingLogLineFragment.count > 2048 {
      pendingLogLineFragment = String(pendingLogLineFragment.suffix(2048))
    }
  }

  private func extractServerURL(fromLogLine line: String) -> URL? {
    if let url = extractServerURLFromJSONLine(line) {
      return url
    }

    return extractServerURLFromText(line)
  }

  private func extractServerURLFromJSONLine(_ line: String) -> URL? {
    guard let data = line.data(using: .utf8) else { return nil }
    guard let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
      return nil
    }

    return extractServerURL(fromJSONObject: object)
  }

  private func extractServerURL(fromJSONObject object: [String: Any]) -> URL? {
    if let urlString = object["url"] as? String, let url = normalizedBaseURL(from: urlString) {
      return url
    }

    if let message = object["msg"] as? String, let url = extractServerURLFromText(message) {
      return url
    }

    if let port = object["port"] as? Int {
      let host = (object["host"] as? String)
        ?? (object["address"] as? String)
        ?? "127.0.0.1"
      if let url = buildURL(host: host, port: port) {
        return url
      }
    }

    return nil
  }

  private func extractServerURLFromText(_ text: String) -> URL? {
    guard let detector = urlDetector else { return nil }
    let range = NSRange(text.startIndex..<text.endIndex, in: text)
    let matches = detector.matches(in: text, options: [], range: range)

    for match in matches {
      guard let foundURL = match.url else { continue }
      guard let scheme = foundURL.scheme, scheme == "http" || scheme == "https" else { continue }
      if let normalized = normalizedBaseURL(foundURL) {
        return normalized
      }
    }

    return nil
  }

  private func normalizedBaseURL(from string: String) -> URL? {
    let trimmed = string.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return nil }
    guard let url = URL(string: trimmed) else { return nil }
    return normalizedBaseURL(url)
  }

  private func normalizedBaseURL(_ url: URL) -> URL? {
    guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return nil }
    if components.scheme == nil {
      components.scheme = "http"
    }
    if let host = components.host {
      components.host = normalizedHostForBrowser(host)
    }
    components.path = "/"
    components.query = nil
    components.fragment = nil
    return components.url
  }

  private func buildURL(host: String, port: Int) -> URL? {
    var components = URLComponents()
    components.scheme = "http"
    components.host = normalizedHostForBrowser(host)
    components.port = port
    components.path = "/"
    return components.url
  }

  private func normalizedHostForBrowser(_ host: String) -> String {
    switch host {
    case "0.0.0.0":
      return "127.0.0.1"
    case "::", "::0":
      return "::1"
    default:
      return host
    }
  }

  private func stripANSIEscapeSequences(from string: String) -> String {
    string.replacingOccurrences(
      of: "\u{001B}\\[[0-9;?]*[ -/]*[@-~]",
      with: "",
      options: .regularExpression
    )
  }

  func applicationDidFinishLaunching(_ notification: Notification) {
    configureMenu()
    installSignalHandlers()

    guard let serverBinaryPath = Bundle.main.path(forResource: "vaporvibe-macos", ofType: nil) else {
      presentFatalError(message: "The bundled vaporvibe binary is missing.")
      return
    }

    serverBinaryURL = URL(fileURLWithPath: serverBinaryPath)
    launchEnvironment["FORCE_COLOR"] = "1"
    launchEnvironment["PINO_PRETTY_COLORS"] = "true"

    launchServerProcess()

    // Note: Browser auto-launch is handled by the Node.js server itself (via the 'open' package)
    // This ensures consistent behavior across CLI, SEA, and app bundle distributions

    NSApp.activate(ignoringOtherApps: true)
  }

  func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
    guard let process = child, process.isRunning else {
      return .terminateNow
    }

    if isTerminatingChild {
      return .terminateLater
    }

    isTerminatingChild = true
    isRestartingChild = false
    terminateChildProcess(forceKillAfter: terminationGracePeriod) {
      sender.reply(toApplicationShouldTerminate: true)
    }

    return .terminateLater
  }

  func applicationWillTerminate(_ notification: Notification) {
    isTerminatingChild = true
    isRestartingChild = false
    forceKillChildIfRunning()
  }

  private func childDidTerminate() {
    guard let process = child, !process.isRunning else { return }
    outputPipe?.fileHandleForReading.readabilityHandler = nil
    outputPipe = nil
    try? logHandle?.close()
    logHandle = nil
    child = nil

    let wasTerminating = isTerminatingChild
    let wasRestarting = isRestartingChild
    isTerminatingChild = false

    if wasRestarting {
      isRestartingChild = false
      launchServerProcess()
      return
    }

    if !wasTerminating {
      NSApp.terminate(nil)
    }
  }

  private func configureMenu() {
    let mainMenu = NSMenu()
    let appMenuItem = NSMenuItem()
    mainMenu.addItem(appMenuItem)

    let appMenu = NSMenu()
    let liveAppItem = NSMenuItem(title: "Open Live App", action: #selector(showLiveApp(_:)), keyEquivalent: "")
    liveAppItem.target = self
    appMenu.addItem(liveAppItem)

    let adminItem = NSMenuItem(title: "Show Admin Console", action: #selector(showAdminConsole(_:)), keyEquivalent: "")
    adminItem.target = self
    appMenu.addItem(adminItem)

    let logsItem = NSMenuItem(title: "Logs", action: #selector(showLogs(_:)), keyEquivalent: "")
    logsItem.target = self
    appMenu.addItem(logsItem)

    let restartItem = NSMenuItem(title: "Restart VaporVibe", action: #selector(restartServer(_:)), keyEquivalent: "")
    restartItem.target = self
    appMenu.addItem(restartItem)

    appMenu.addItem(NSMenuItem.separator())

    let quitTitle = "Quit VaporVibe"
    let quitItem = NSMenuItem(title: quitTitle, action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
    quitItem.target = NSApp
    appMenu.addItem(quitItem)
    appMenuItem.submenu = appMenu

    NSApp.mainMenu = mainMenu
    NSApp.setActivationPolicy(.regular)
  }

  func applicationDockMenu(_ sender: NSApplication) -> NSMenu? {
    let menu = NSMenu()

    let liveItem = NSMenuItem(title: "Open Live App", action: #selector(showLiveApp(_:)), keyEquivalent: "")
    liveItem.target = self
    menu.addItem(liveItem)

    let adminItem = NSMenuItem(title: "Show Admin Console", action: #selector(showAdminConsole(_:)), keyEquivalent: "")
    adminItem.target = self
    menu.addItem(adminItem)

    let logsItem = NSMenuItem(title: "Logs", action: #selector(showLogs(_:)), keyEquivalent: "")
    logsItem.target = self
    menu.addItem(logsItem)

    let restartItem = NSMenuItem(title: "Restart", action: #selector(restartServer(_:)), keyEquivalent: "")
    restartItem.target = self
    menu.addItem(restartItem)

    return menu
  }

  @objc private func showLiveApp(_ sender: Any?) {
    openWhenServerReady(pathComponent: nil)
  }

  @objc private func showAdminConsole(_ sender: Any?) {
    openWhenServerReady(pathComponent: adminConsolePathComponent)
  }

  @objc private func showLogs(_ sender: Any?) {
    logWindowController.showLogWindow()
  }

  @objc private func restartServer(_ sender: Any?) {
    guard let process = child, process.isRunning else {
      launchServerProcess()
      return
    }

    isRestartingChild = true
    process.terminate()
  }

  private func launchServerProcess() {
    guard let serverBinaryURL else { return }

    pendingLogLineFragment = ""
    setResolvedServerURL(defaultServerURL, synchronous: true)

    let process = Process()
    process.executableURL = serverBinaryURL
    process.arguments = launchArguments
    process.environment = launchEnvironment
    process.standardInput = FileHandle.standardInput

    let pipe = Pipe()
    process.standardOutput = pipe
    process.standardError = pipe

    logHandle = configureLoggingPipe(pipe) { [weak self] data in
      self?.handleLogData(data)
    }

    outputPipe = pipe

    process.terminationHandler = { [weak self] _ in
      DispatchQueue.main.async {
        self?.childDidTerminate()
      }
    }

    do {
      try process.run()
    } catch {
      presentFatalError(message: "Failed to launch vaporvibe: \(error.localizedDescription)")
      return
    }

    child = process
  }

  private func terminateChildProcess(forceKillAfter timeout: TimeInterval, completion: (() -> Void)? = nil) {
    childTerminationQueue.async { [weak self] in
      guard let self else { return }

      guard let process = self.child else {
        DispatchQueue.main.async { [weak self] in
          if let self {
            if self.isRestartingChild {
              self.isRestartingChild = false
            }
            self.isTerminatingChild = false
          }
          completion?()
        }
        return
      }

      if process.isRunning {
        process.terminate()
      }

      if process.isRunning && timeout > 0 {
        let deadline = Date().addingTimeInterval(timeout)
        while process.isRunning && Date() < deadline {
          Thread.sleep(forTimeInterval: 0.05)
        }
      }

      if process.isRunning {
        kill(process.processIdentifier, SIGKILL)
      }

      process.waitUntilExit()

      DispatchQueue.main.async { [weak self] in
        self?.childDidTerminate()
        completion?()
      }
    }
  }

  private func forceKillChildIfRunning() {
    let needsCleanup = childTerminationQueue.sync { () -> Bool in
      guard let process = child, process.isRunning else { return false }
      kill(process.processIdentifier, SIGKILL)
      process.waitUntilExit()
      return true
    }

    if needsCleanup {
      childDidTerminate()
    }
  }

  private func handleLogData(_ data: Data) {
    guard !data.isEmpty else { return }
    guard let string = String(data: data, encoding: .utf8) else { return }

    processLogChunkForURLDetection(string)

    let attributed = ansiParser.parse(string)
    if attributed.length == 0 { return }

    DispatchQueue.main.async { [weak self] in
      self?.logWindowController.append(attributed)
    }
  }

  private func presentFatalError(message: String) {
    let alert = NSAlert()
    alert.messageText = "VaporVibe"
    alert.informativeText = message
    alert.alertStyle = .critical
    alert.runModal()
    isTerminatingChild = true
    isRestartingChild = false
    terminateChildProcess(forceKillAfter: terminationGracePeriod) {
      NSApp.terminate(nil)
    }
  }

  private func openWhenServerReady(pathComponent: String?) {
    DispatchQueue.global().async { [weak self] in
      guard let self else { return }

      let baseURL = self.waitForServer(timeout: 5) ?? self.currentServerURL()
      let destination: URL
      if let path = pathComponent, !path.isEmpty {
        destination = baseURL.appendingPathComponent(path)
      } else {
        destination = baseURL
      }

      DispatchQueue.main.async {
        NSWorkspace.shared.open(destination)
      }
    }
  }

  @discardableResult
  private func waitForServer(timeout: TimeInterval) -> URL? {
    let deadline = Date().addingTimeInterval(timeout)
    let session = URLSession(configuration: .ephemeral)

    defer {
      session.invalidateAndCancel()
    }

    while Date() < deadline {
      let baseURL = currentServerURL()
      let request = URLRequest(
        url: baseURL,
        cachePolicy: .reloadIgnoringLocalCacheData,
        timeoutInterval: 1.5
      )

      let semaphore = DispatchSemaphore(value: 0)
      var reachable = false

      let task = session.dataTask(with: request) { (_, response, _) in
        if let http = response as? HTTPURLResponse, (200..<500).contains(http.statusCode) {
          reachable = true
        }
        semaphore.signal()
      }
      task.resume()

      _ = semaphore.wait(timeout: .now() + 1.6)
      if reachable {
        return baseURL
      }

      Thread.sleep(forTimeInterval: 0.25)
    }

    return nil
  }

  private func installSignalHandlers() {
    signalSources.forEach { $0.cancel() }
    signalSources.removeAll()

    for signum in monitoredSignals {
      signal(signum, SIG_IGN)
      let source = DispatchSource.makeSignalSource(signal: signum, queue: DispatchQueue.global(qos: .userInitiated))
      source.setEventHandler { [weak self] in
        self?.handleTerminationSignal(signum)
      }
      source.resume()
      signalSources.append(source)
    }
  }

  private func handleTerminationSignal(_ signum: Int32) {
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      if self.isTerminatingChild { return }
      self.isTerminatingChild = true
      self.isRestartingChild = false
      self.signalSources.forEach { $0.cancel() }
      self.signalSources.removeAll()
      self.terminateChildProcess(forceKillAfter: 1) {
        signal(signum, SIG_DFL)
        raise(signum)
      }
    }
  }

  deinit {
    signalSources.forEach { $0.cancel() }
    for signum in monitoredSignals {
      signal(signum, SIG_DFL)
    }
  }
}

let app = NSApplication.shared
let delegate = LauncherDelegate()
app.delegate = delegate
app.run()
