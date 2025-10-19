import AppKit
import Foundation

private let serverURL = URL(string: "http://127.0.0.1:3000/")!
private let logDirectory = FileManager.default.homeDirectoryForCurrentUser
  .appendingPathComponent("Library/Logs/VaporVibe", isDirectory: true)
private let logFileURL = logDirectory.appendingPathComponent("vaporvibe.log", isDirectory: false)
private let adminConsoleURL = serverURL.appendingPathComponent("vaporvibe")

@discardableResult
private func waitForServer(timeout: TimeInterval) -> Bool {
  let deadline = Date().addingTimeInterval(timeout)
  let session = URLSession(configuration: .ephemeral)
  let request = URLRequest(url: serverURL, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 1.5)

  while Date() < deadline {
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
    if reachable { return true }
    Thread.sleep(forTimeInterval: 0.25)
  }
  return false
}

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

  func applicationDidFinishLaunching(_ notification: Notification) {
    configureMenu()

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
    process.terminate()

    DispatchQueue.global().async { [weak self] in
      process.waitUntilExit()
      DispatchQueue.main.async {
        self?.childDidTerminate()
        sender.reply(toApplicationShouldTerminate: true)
      }
    }

    return .terminateLater
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

  @objc private func showAdminConsole(_ sender: Any?) {
    DispatchQueue.global().async {
      _ = waitForServer(timeout: 5)
      DispatchQueue.main.async {
        NSWorkspace.shared.open(adminConsoleURL)
      }
    }
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

  private func handleLogData(_ data: Data) {
    guard !data.isEmpty else { return }
    guard let string = String(data: data, encoding: .utf8) else { return }

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
    NSApp.terminate(nil)
  }
}

let app = NSApplication.shared
let delegate = LauncherDelegate()
app.delegate = delegate
app.run()
