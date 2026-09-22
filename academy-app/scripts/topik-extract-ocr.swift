import AppKit
import Foundation
import Vision

// Local-only OCR. The input image and recognised text never leave this machine.
// Bounding boxes use a normalized, top-left origin to match page image crops.
struct Bounds: Codable {
    let x: Double
    let y: Double
    let width: Double
    let height: Double
}
struct OCRLine: Codable {
    let text: String
    let confidence: Float
    let bbox: Bounds
    let charBoxes: [OCRCharacter]
}
struct OCRCharacter: Codable {
    let text: String
    let index: Int
    let bbox: Bounds
}
struct OCRResult: Codable {
    let engine: String
    let languages: [String]
    let text: String
    let lines: [OCRLine]
}

guard CommandLine.arguments.count == 2 else {
    fputs("Usage: topik-extract-ocr /absolute/path/to/page.png\n", stderr)
    exit(2)
}
let fileURL = URL(fileURLWithPath: CommandLine.arguments[1])
let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.recognitionLanguages = ["ko-KR", "en-US"]
request.usesLanguageCorrection = false
request.minimumTextHeight = 0.004
request.usesCPUOnly = true

do {
    let handler = VNImageRequestHandler(url: fileURL, options: [:])
    try handler.perform([request])
    let lines = (request.results ?? []).compactMap { observation -> OCRLine? in
        guard let candidate = observation.topCandidates(1).first else { return nil }
        let box = observation.boundingBox
        let recognized = candidate.string
        var characters: [OCRCharacter] = []
        var scalarIndex = recognized.unicodeScalars.startIndex
        var offset = 0
        while scalarIndex < recognized.unicodeScalars.endIndex {
            let nextIndex = recognized.unicodeScalars.index(after: scalarIndex)
            if let characterBox = try? candidate.boundingBox(for: scalarIndex..<nextIndex) {
                let bounds = characterBox.boundingBox
                characters.append(OCRCharacter(
                    text: String(recognized.unicodeScalars[scalarIndex]),
                    index: offset,
                    bbox: Bounds(x: bounds.minX, y: 1 - bounds.maxY,
                                 width: bounds.width, height: bounds.height)
                ))
            }
            scalarIndex = nextIndex
            offset += 1
        }
        return OCRLine(
            text: candidate.string,
            confidence: candidate.confidence,
            bbox: Bounds(x: box.minX, y: 1 - box.maxY, width: box.width, height: box.height),
            charBoxes: characters
        )
    }.sorted {
        if abs($0.bbox.y - $1.bbox.y) < 0.006 { return $0.bbox.x < $1.bbox.x }
        return $0.bbox.y < $1.bbox.y
    }
    let result = OCRResult(engine: "Apple Vision", languages: request.recognitionLanguages,
                           text: lines.map(\.text).joined(separator: "\n"), lines: lines)
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
    let data = try encoder.encode(result)
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data("\n".utf8))
} catch {
    fputs("OCR failed: \(error) / \(error as NSError)\n", stderr)
    exit(1)
}
