import AppKit

let canvasSize = CGSize(width: 1024, height: 1024)
let outputURL = URL(fileURLWithPath: "VaporVibeIcon.png", relativeTo: URL(fileURLWithPath: FileManager.default.currentDirectoryPath))

func cgPath(from bezier: NSBezierPath) -> CGPath {
  let path = CGMutablePath()
  var points = [NSPoint](repeating: .zero, count: 3)
  for index in 0..<bezier.elementCount {
    let type = bezier.element(at: index, associatedPoints: &points)
    switch type {
    case .moveTo:
      path.move(to: points[0])
    case .lineTo:
      path.addLine(to: points[0])
    case .curveTo, .cubicCurveTo:
      path.addCurve(to: points[2], control1: points[0], control2: points[1])
    case .quadraticCurveTo:
      path.addQuadCurve(to: points[1], control: points[0])
    case .closePath:
      path.closeSubpath()
    @unknown default:
      break
    }
  }
  return path
}

func color(_ hex: UInt32, alpha: CGFloat = 1.0) -> NSColor {
  let r = CGFloat((hex >> 16) & 0xFF) / 255.0
  let g = CGFloat((hex >> 8) & 0xFF) / 255.0
  let b = CGFloat(hex & 0xFF) / 255.0
  return NSColor(calibratedRed: r, green: g, blue: b, alpha: alpha)
}

let image = NSImage(size: canvasSize)
image.lockFocus()

guard let context = NSGraphicsContext.current?.cgContext else {
  fatalError("Unable to obtain graphics context")
}

let fullRect = CGRect(origin: .zero, size: canvasSize)
let cornerRadius: CGFloat = 220
let roundedRect = NSBezierPath(roundedRect: fullRect, xRadius: cornerRadius, yRadius: cornerRadius)
context.addPath(cgPath(from: roundedRect))
context.clip()

let backgroundGradient = CGGradient(
  colorsSpace: CGColorSpaceCreateDeviceRGB(),
  colors: [
    color(0xf7fbff).cgColor,
    color(0xe4ecfc).cgColor,
    color(0x183dba).cgColor
  ] as CFArray,
  locations: [0.0, 0.58, 1.0]
)!
context.drawLinearGradient(
  backgroundGradient,
  start: CGPoint(x: 0, y: canvasSize.height),
  end: CGPoint(x: canvasSize.width, y: 0),
  options: []
)

context.saveGState()
let lightGlowRect = fullRect.insetBy(dx: 70, dy: 70)
let glowPath = NSBezierPath(roundedRect: lightGlowRect, xRadius: 180, yRadius: 180)
context.addPath(cgPath(from: glowPath))
context.setFillColor(color(0xffffff, alpha: 0.22).cgColor)
context.fillPath()
context.restoreGState()

context.saveGState()
let grainGradient = CGGradient(
  colorsSpace: CGColorSpaceCreateDeviceRGB(),
  colors: [
    color(0x9ec5ff, alpha: 0.22).cgColor,
    color(0xffffff, alpha: 0.0).cgColor
  ] as CFArray,
  locations: [0.0, 1.0]
)!
context.drawRadialGradient(
  grainGradient,
  startCenter: CGPoint(x: canvasSize.width * 0.25, y: canvasSize.height * 0.78),
  startRadius: 20,
  endCenter: CGPoint(x: canvasSize.width * 0.25, y: canvasSize.height * 0.78),
  endRadius: 420,
  options: []
)
context.restoreGState()

let center = CGPoint(x: canvasSize.width / 2, y: canvasSize.height / 2)

func drawRing(radius: CGFloat, width: CGFloat, startAngle: CGFloat, endAngle: CGFloat, startColor: NSColor, endColor: NSColor) {
  context.saveGState()
  context.setLineWidth(width)
  context.setLineCap(.round)
  let arcPath = NSBezierPath()
  arcPath.appendArc(withCenter: center, radius: radius, startAngle: startAngle, endAngle: endAngle, clockwise: false)
  context.addPath(cgPath(from: arcPath))
  context.replacePathWithStrokedPath()
  context.clip()
  let gradient = CGGradient(
    colorsSpace: CGColorSpaceCreateDeviceRGB(),
    colors: [startColor.cgColor, endColor.cgColor] as CFArray,
    locations: [0.0, 1.0]
  )!
  context.drawLinearGradient(
    gradient,
    start: CGPoint(x: center.x - radius, y: center.y - radius),
    end:   CGPoint(x: center.x + radius, y: center.y + radius),
    options: []
  )
  context.restoreGState()
}

drawRing(
  radius: 240,
  width: 44,
  startAngle: 30,
  endAngle: 330,
  startColor: color(0x60a5fa),
  endColor: color(0x1d4ed8)
)

drawRing(
  radius: 240,
  width: 44,
  startAngle: 150,
  endAngle: 210,
  startColor: color(0xffffff, alpha: 0.85),
  endColor: color(0xffffff, alpha: 0.15)
)

context.saveGState()
context.setLineWidth(52)
context.setLineCap(.round)
context.setStrokeColor(color(0xdee7ff, alpha: 0.45).cgColor)
context.addArc(center: center, radius: 198, startAngle: 200 * .pi/180, endAngle: 330 * .pi/180, clockwise: false)
context.strokePath()
context.restoreGState()

let coreGradient = CGGradient(
  colorsSpace: CGColorSpaceCreateDeviceRGB(),
  colors: [color(0xffffff).cgColor, color(0xc7d7ff).cgColor] as CFArray,
  locations: [0.0, 1.0]
)!
context.saveGState()
let coreRect = CGRect(x: center.x - 140, y: center.y - 140, width: 280, height: 280)
context.addEllipse(in: coreRect)
context.clip()
context.drawRadialGradient(
  coreGradient,
  startCenter: center,
  startRadius: 0,
  endCenter: CGPoint(x: center.x, y: center.y - 40),
  endRadius: 220,
  options: []
)
context.restoreGState()

context.saveGState()
context.setLineWidth(18)
context.setStrokeColor(color(0x93c5fd, alpha: 0.85).cgColor)
context.setShadow(offset: CGSize(width: 0, height: 18), blur: 32, color: color(0x1d4ed8, alpha: 0.35).cgColor)
let orbit = NSBezierPath()
orbit.appendArc(withCenter: center, radius: 130, startAngle: -60, endAngle: 160, clockwise: false)
context.addPath(cgPath(from: orbit))
context.strokePath()
context.restoreGState()

let spark = NSBezierPath(roundedRect: CGRect(x: center.x - 20, y: center.y + 224, width: 40, height: 120), xRadius: 20, yRadius: 20)
context.saveGState()
context.addPath(cgPath(from: spark))
context.setFillColor(color(0xffffff, alpha: 0.85).cgColor)
context.setShadow(offset: CGSize(width: 0, height: 18), blur: 24, color: color(0x1d4ed8, alpha: 0.28).cgColor)
context.fillPath()
context.restoreGState()

let panelRect = CGRect(x: center.x - 280, y: center.y - 320, width: 560, height: 220)
let panelPath = NSBezierPath(roundedRect: panelRect, xRadius: 60, yRadius: 60)
context.saveGState()
context.addPath(cgPath(from: panelPath))
context.setFillColor(color(0xffffff, alpha: 0.28).cgColor)
context.fillPath()
context.restoreGState()

let accentPanelRect = CGRect(x: center.x - 260, y: center.y - 302, width: 520, height: 184)
let accentPath = NSBezierPath(roundedRect: accentPanelRect, xRadius: 54, yRadius: 54)
context.saveGState()
context.addPath(cgPath(from: accentPath))
context.setStrokeColor(color(0x2563eb, alpha: 0.65).cgColor)
context.setLineWidth(2.5)
context.strokePath()
context.restoreGState()

let paragraph = NSMutableParagraphStyle()
paragraph.alignment = .center

let headingAttributes: [NSAttributedString.Key: Any] = [
  .font: NSFont.systemFont(ofSize: 150, weight: .heavy),
  .foregroundColor: color(0x0f172a, alpha: 0.92),
  .paragraphStyle: paragraph
]
let subheadingAttributes: [NSAttributedString.Key: Any] = [
  .font: NSFont.systemFont(ofSize: 80, weight: .semibold),
  .foregroundColor: color(0x1e3a8a, alpha: 0.9),
  .paragraphStyle: paragraph
]

let headingRect = CGRect(x: 0, y: center.y - 130, width: canvasSize.width, height: 160)
let subheadingRect = CGRect(x: 0, y: center.y - 260, width: canvasSize.width, height: 120)

let heading = "Serve"
let subheading = "LLM"
heading.draw(in: headingRect, withAttributes: headingAttributes)
subheading.draw(in: subheadingRect, withAttributes: subheadingAttributes)

context.saveGState()
context.setFillColor(color(0xffffff, alpha: 0.08).cgColor)
let dotPositions: [CGPoint] = [
  CGPoint(x: center.x - 310, y: center.y + 290),
  CGPoint(x: center.x + 320, y: center.y - 280),
  CGPoint(x: center.x - 340, y: center.y - 180),
  CGPoint(x: center.x + 280, y: center.y + 210)
]
for point in dotPositions {
  let dotRect = CGRect(x: point.x - 18, y: point.y - 18, width: 36, height: 36)
  context.fillEllipse(in: dotRect)
}
context.restoreGState()

image.unlockFocus()

guard let tiff = image.tiffRepresentation, let bitmap = NSBitmapImageRep(data: tiff), let pngData = bitmap.representation(using: .png, properties: [:]) else {
  fatalError("Failed to encode icon PNG")
}

try pngData.write(to: outputURL)
print("Wrote icon to \(outputURL.path)")
