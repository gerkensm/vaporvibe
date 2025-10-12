import AppKit
import Dispatch
import Foundation

private let serverURL = URL(string: "http://127.0.0.1:3000/")!
private let adminConsoleURL = serverURL.appendingPathComponent("serve-llm/", isDirectory: false)
private let logDirectory = FileManager.default.homeDirectoryForCurrentUser
  .appendingPathComponent("Library/Logs/ServeLLM", isDirectory: true)
private let logFileURL = logDirectory.appendingPathComponent("serve-llm.log", isDirectory: false)

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

private func configureLoggingPipe(_ pipe: Pipe) -> FileHandle? {
  do {
    try FileManager.default.createDirectory(at: logDirectory, withIntermediateDirectories: true, attributes: nil)
    if !FileManager.default.fileExists(atPath: logFileURL.path) {
      FileManager.default.createFile(atPath: logFileURL.path, contents: nil, attributes: nil)
    }
    let logHandle = try FileHandle(forWritingTo: logFileURL)
    try logHandle.seekToEnd()

    let queue = DispatchQueue(label: "serve-llm.log-writer")
    pipe.fileHandleForReading.readabilityHandler = { handle in
      let data = handle.availableData
      guard !data.isEmpty else {
        handle.readabilityHandler = nil
        return
      }
      queue.async {
        do {
          try logHandle.write(contentsOf: data)
        } catch {
          fputs("ServeLLM: failed to write logs: \(error)\n", stderr)
        }
      }
    }
    return logHandle
  } catch {
    fputs("ServeLLM: unable to configure logfile: \(error)\n", stderr)
    return nil
  }
}

private final class LogWindowController: NSWindowController {
  private let logURL: URL
  private let textView = NSTextView(frame: .zero)
  private var observationSource: DispatchSourceFileSystemObject?
  private var fileHandle: FileHandle?
  private var lastReadOffset: UInt64 = 0
  private let maximumInitialBytes = 200_000

  init(logURL: URL) {
    self.logURL = logURL

    let window = NSWindow(
      contentRect: NSRect(x: 0, y: 0, width: 760, height: 520),
      styleMask: [.titled, .closable, .miniaturizable, .resizable],
      backing: .buffered,
      defer: false
    )
    window.title = "Serve LLM Logs"

    super.init(window: window)

    configureTextView()
    window.delegate = self
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  func present() {
    ensureFileReady()
    if window == nil {
      _ = self.window
    }
    showWindow(nil)
    window?.makeKeyAndOrderFront(nil)
    NSApp.activate(ignoringOtherApps: true)
    startObservingIfNeeded()
    scrollToBottom()
  }

  private func configureTextView() {
    textView.isEditable = false
    textView.isVerticallyResizable = true
    textView.isHorizontallyResizable = false
    textView.textContainerInset = NSSize(width: 12, height: 12)
    textView.textContainer?.containerSize = NSSize(width: .greatestFiniteMagnitude, height: .greatestFiniteMagnitude)
    textView.textContainer?.widthTracksTextView = true
    textView.usesAdaptiveColorMappingForDarkAppearance = true
    textView.font = NSFont.monospacedSystemFont(ofSize: 12, weight: .regular)

    let scrollView = NSScrollView(frame: textView.bounds)
    scrollView.hasVerticalScroller = true
    scrollView.autoresizingMask = [.width, .height]
    scrollView.documentView = textView
    scrollView.borderType = .noBorder

    window?.contentView = scrollView
  }

  private func ensureFileReady() {
    let fileManager = FileManager.default
    do {
      try fileManager.createDirectory(at: logURL.deletingLastPathComponent(), withIntermediateDirectories: true, attributes: nil)
      if !fileManager.fileExists(atPath: logURL.path) {
        fileManager.createFile(atPath: logURL.path, contents: nil, attributes: nil)
      }
    } catch {
      presentInlineError(message: "Unable to prepare log file: \(error.localizedDescription)")
    }
  }

  private func startObservingIfNeeded() {
    guard observationSource == nil else { return }

    do {
      let handle = try FileHandle(forReadingFrom: logURL)
      fileHandle = handle

      try loadInitialContent(using: handle)

      let descriptor = handle.fileDescriptor
      let source = DispatchSource.makeFileSystemObjectSource(fileDescriptor: descriptor, eventMask: .write, queue: .main)
      source.setEventHandler { [weak self] in
        self?.appendNewContent()
      }
      source.setCancelHandler { [weak self] in
        try? self?.fileHandle?.close()
        self?.fileHandle = nil
        self?.lastReadOffset = 0
      }
      observationSource = source
      source.resume()
    } catch {
      presentInlineError(message: "Unable to read logs: \(error.localizedDescription)")
    }
  }

  private func loadInitialContent(using handle: FileHandle) throws {
    let attributes = try FileManager.default.attributesOfItem(atPath: logURL.path)
    let fileSize = (attributes[.size] as? NSNumber)?.uint64Value ?? 0

    let initialData: Data
    if fileSize > UInt64(maximumInitialBytes) {
      let offset = fileSize - UInt64(maximumInitialBytes)
      try handle.seek(toOffset: offset)
      initialData = try handle.readToEnd() ?? Data()
      lastReadOffset = fileSize
    } else {
      try handle.seek(toOffset: 0)
      initialData = try handle.readToEnd() ?? Data()
      lastReadOffset = UInt64(initialData.count)
    }

    if let string = String(data: initialData, encoding: .utf8) {
      textView.string = string
    } else {
      textView.string = ""
      presentInlineError(message: "Log output contains non-UTF8 data.")
    }
  }

  private func appendNewContent() {
    guard let handle = fileHandle else { return }
    do {
      let fileSize = try handle.seekToEnd()
      if fileSize < lastReadOffset {
        lastReadOffset = 0
      }
      try handle.seek(toOffset: lastReadOffset)
      guard let data = try handle.readToEnd(), !data.isEmpty else { return }
      lastReadOffset += UInt64(data.count)

      guard let string = String(data: data, encoding: .utf8) else {
        presentInlineError(message: "Received non-UTF8 log data.")
        return
      }

      if let storage = textView.textStorage {
        storage.append(NSAttributedString(string: string))
      } else {
        textView.string += string
      }
      scrollToBottom()
    } catch {
      presentInlineError(message: "Failed to update logs: \(error.localizedDescription)")
    }
  }

  private func scrollToBottom() {
    textView.scrollToEndOfDocument(nil)
  }

  private func presentInlineError(message: String) {
    if textView.string.isEmpty {
      textView.string = message + "\n"
    } else {
      textView.string += "\n" + message + "\n"
    }
  }
}

extension LogWindowController: NSWindowDelegate {
  func windowWillClose(_ notification: Notification) {
    observationSource?.cancel()
    observationSource = nil
    fileHandle = nil
    lastReadOffset = 0
  }
}

final class LauncherDelegate: NSObject, NSApplicationDelegate, NSMenuItemValidation {
  private var child: Process?
  private var outputPipe: Pipe?
  private var logHandle: FileHandle?
  private var isTerminatingChild = false
  private var pendingRestart = false
  private var pendingTerminationReplyTarget: NSApplication?
  private var serverBinaryURL: URL?
  private var launchArguments: [String] = []
  private var launchEnvironment: [String: String] = [:]
  private lazy var logWindowController = LogWindowController(logURL: logFileURL)

  func applicationDidFinishLaunching(_ notification: Notification) {
    configureMenu()

    guard let serverBinaryPath = Bundle.main.path(forResource: "serve-llm-macos", ofType: nil) else {
      presentFatalError(message: "The bundled serve-llm binary is missing.")
      return
    }

    serverBinaryURL = URL(fileURLWithPath: serverBinaryPath)
    launchArguments = Array(CommandLine.arguments.dropFirst())

    var environment = ProcessInfo.processInfo.environment
    environment["PINO_PRETTY"] = "false"
    launchEnvironment = environment

    launchServeLLM()
    NSApp.activate(ignoringOtherApps: true)
  }

  func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
    guard let process = child, process.isRunning else {
      return .terminateNow
    }

    pendingRestart = false
    pendingTerminationReplyTarget = sender

    if !isTerminatingChild {
      isTerminatingChild = true
      process.terminate()
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
    isTerminatingChild = false

    if pendingRestart {
      pendingTerminationReplyTarget = nil
      pendingRestart = false
      launchServeLLM()
      return
    }

    if let replyTarget = pendingTerminationReplyTarget {
      pendingTerminationReplyTarget = nil
      replyTarget.reply(toApplicationShouldTerminate: true)
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

    let adminItem = NSMenuItem(title: "Show Admin Console", action: #selector(openAdminConsole(_:)), keyEquivalent: "a")
    adminItem.keyEquivalentModifierMask = [.command, .shift]
    adminItem.target = self
    appMenu.addItem(adminItem)

    let logsItem = NSMenuItem(title: "Show Logs", action: #selector(showLogs(_:)), keyEquivalent: "l")
    logsItem.keyEquivalentModifierMask = [.command, .shift]
    logsItem.target = self
    appMenu.addItem(logsItem)

    let restartItem = NSMenuItem(title: "Restart Serve LLM", action: #selector(restartServer(_:)), keyEquivalent: "r")
    restartItem.keyEquivalentModifierMask = [.command, .shift]
    restartItem.target = self
    appMenu.addItem(restartItem)

    appMenu.addItem(NSMenuItem.separator())

    let quitTitle = "Quit Serve LLM"
    let quitItem = NSMenuItem(title: quitTitle, action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
    quitItem.target = NSApp
    appMenu.addItem(quitItem)
    appMenuItem.submenu = appMenu

    NSApp.mainMenu = mainMenu
    NSApp.setActivationPolicy(.regular)
  }

  private func presentFatalError(message: String) {
    let alert = NSAlert()
    alert.messageText = "Serve LLM"
    alert.informativeText = message
    alert.alertStyle = .critical
    alert.runModal()
    NSApp.terminate(nil)
  }

  private func launchServeLLM() {
    guard child?.isRunning != true else { return }
    guard let binaryURL = serverBinaryURL else { return }

    let process = Process()
    process.executableURL = binaryURL
    process.arguments = launchArguments
    process.environment = launchEnvironment
    process.standardInput = FileHandle.standardInput

    let pipe = Pipe()
    process.standardOutput = pipe
    process.standardError = pipe

    logHandle = configureLoggingPipe(pipe)
    outputPipe = pipe

    process.terminationHandler = { [weak self] _ in
      DispatchQueue.main.async {
        self?.childDidTerminate()
      }
    }

    do {
      try process.run()
      child = process
    } catch {
      presentFatalError(message: "Failed to launch serve-llm: \(error.localizedDescription)")
      return
    }
  }

  private func presentWarning(message: String) {
    let alert = NSAlert()
    alert.messageText = "Serve LLM"
    alert.informativeText = message
    alert.alertStyle = .warning
    alert.runModal()
  }

  @objc private func openAdminConsole(_ sender: Any?) {
    DispatchQueue.global(qos: .userInitiated).async { [weak self] in
      guard let self else { return }
      let reachable = waitForServer(timeout: 8)
      DispatchQueue.main.async {
        if reachable {
          NSWorkspace.shared.open(adminConsoleURL)
        } else {
          self.presentWarning(message: "The admin console is not reachable yet. Please try again once the server has finished starting up.")
        }
      }
    }
  }

  @objc private func showLogs(_ sender: Any?) {
    logWindowController.present()
  }

  @objc private func restartServer(_ sender: Any?) {
    if child?.isRunning == true {
      if pendingRestart {
        return
      }
      pendingRestart = true
      isTerminatingChild = true
      child?.terminate()
    } else {
      launchServeLLM()
    }
  }

  func applicationDockMenu(_ sender: NSApplication) -> NSMenu? {
    let menu = NSMenu()

    let adminItem = NSMenuItem(title: "Show Admin Console", action: #selector(openAdminConsole(_:)), keyEquivalent: "")
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

  func validateMenuItem(_ menuItem: NSMenuItem) -> Bool {
    switch menuItem.action {
    case #selector(openAdminConsole(_:)):
      return child?.isRunning == true
    case #selector(restartServer(_:)):
      return serverBinaryURL != nil && !pendingRestart
    case #selector(showLogs(_:)):
      return true
    default:
      return true
    }
  }
}

let app = NSApplication.shared
let delegate = LauncherDelegate()
app.delegate = delegate
app.run()
