import AppKit
import Foundation

private let serverURL = URL(string: "http://127.0.0.1:3000/")!
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

final class LauncherDelegate: NSObject, NSApplicationDelegate {
  private var child: Process?
  private var outputPipe: Pipe?
  private var logHandle: FileHandle?
  private var isTerminatingChild = false

  func applicationDidFinishLaunching(_ notification: Notification) {
    configureMenu()

    guard let serverBinaryPath = Bundle.main.path(forResource: "serve-llm-macos", ofType: nil) else {
      presentFatalError(message: "The bundled serve-llm binary is missing.")
      return
    }

    let serverBinaryURL = URL(fileURLWithPath: serverBinaryPath)
    let process = Process()
    process.executableURL = serverBinaryURL
    process.arguments = Array(CommandLine.arguments.dropFirst())
    process.environment = ProcessInfo.processInfo.environment
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
    } catch {
      presentFatalError(message: "Failed to launch serve-llm: \(error.localizedDescription)")
      return
    }

    child = process

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
    isTerminatingChild = false

    if !wasTerminating {
      NSApp.terminate(nil)
    }
  }

  private func configureMenu() {
    let mainMenu = NSMenu()
    let appMenuItem = NSMenuItem()
    mainMenu.addItem(appMenuItem)

    let appMenu = NSMenu()
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
}

let app = NSApplication.shared
let delegate = LauncherDelegate()
app.delegate = delegate
app.run()
