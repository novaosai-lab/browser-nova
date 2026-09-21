// Reproducible, vector-drawn app icon. Run: swift scripts/generate-icon.swift
import AppKit
import Foundation

let directory = URL(fileURLWithPath: FileManager.default.currentDirectoryPath).appendingPathComponent("build/icon.iconset")
try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)

func render(_ size: Int, name: String) throws {
    let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size,
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
        colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
    let scale = CGFloat(size) / 1024
    let transform = NSAffineTransform()
    transform.scale(by: scale)
    transform.concat()

    let tile = NSBezierPath(roundedRect: NSRect(x: 72, y: 72, width: 880, height: 880), xRadius: 204, yRadius: 204)
    NSGradient(starting: NSColor(srgbRed: 0.08, green: 0.10, blue: 0.25, alpha: 1),
               ending: NSColor(srgbRed: 0.29, green: 0.19, blue: 0.69, alpha: 1))!.draw(in: tile, angle: 65)
    let ring = NSBezierPath(ovalIn: NSRect(x: 186, y: 186, width: 652, height: 652))
    ring.lineWidth = 22
    NSColor(srgbRed: 0.54, green: 0.60, blue: 1, alpha: 0.65).setStroke()
    ring.stroke()
    let n = NSBezierPath()
    n.move(to: NSPoint(x: 350, y: 344))
    n.line(to: NSPoint(x: 350, y: 680))
    n.line(to: NSPoint(x: 674, y: 344))
    n.line(to: NSPoint(x: 674, y: 680))
    n.lineWidth = 68
    n.lineCapStyle = .round
    n.lineJoinStyle = .round
    NSColor.white.setStroke()
    n.stroke()
    NSColor(srgbRed: 0.37, green: 0.91, blue: 0.91, alpha: 1).setFill()
    NSBezierPath(ovalIn: NSRect(x: 724, y: 714, width: 92, height: 92)).fill()
    NSGraphicsContext.restoreGraphicsState()
    try bitmap.representation(using: .png, properties: [:])!.write(to: directory.appendingPathComponent(name))
}

for size in [16, 32, 128, 256, 512] {
    try render(size, name: "icon_\(size)x\(size).png")
    try render(size * 2, name: "icon_\(size)x\(size)@2x.png")
}
let process = Process()
process.executableURL = URL(fileURLWithPath: "/usr/bin/iconutil")
process.arguments = ["-c", "icns", directory.path, "-o", "build/icon.icns"]
try process.run()
process.waitUntilExit()
if process.terminationStatus != 0 { exit(process.terminationStatus) }
print("Created build/icon.icns")
