import ExpoModulesCore
import Vision
import UIKit

/**
 * On-device person detection via Apple Vision (research.md §3, iOS path).
 *
 * Why on-device: no network round trip for the most latency-sensitive step
 * (SC-001: bubbles within 5s of capture), zero per-call vision API cost, and
 * segmentation keeps working with poor connectivity.
 *
 * Expo Modules `AsyncFunction`s run off the main thread by default — Vision
 * requests are CPU-heavy, so this is load-bearing for the constitution's
 * Performance First rule (never block the UI), not just a nicety.
 */
public class VisionSegmentationModule: Module {
  public func definition() -> ModuleDefinition {
    Name("VisionSegmentation")

    // Detect every distinguishable person; returns normalized top-left-origin
    // rects matching the BoundingRegion convention in src/types/scan.ts.
    AsyncFunction("detectPeople") { (photoUri: URL) -> [[String: Double]] in
      guard let image = UIImage(contentsOfFile: photoUri.path),
            let cgImage = image.cgImage else {
        throw InvalidPhotoException(photoUri.path)
      }

      let request = VNDetectHumanRectanglesRequest()
      // upperBodyOnly=false: garments include pants/shoes, so we need the
      // full body rect, not Vision's default torso-and-head detection.
      request.upperBodyOnly = false

      let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
      try handler.perform([request])

      let observations = request.results ?? []
      return observations.map { observation in
        let box = observation.boundingBox
        return [
          "x": box.origin.x,
          // Vision uses a bottom-left origin; RN layout (and our
          // BoundingRegion contract) uses top-left — flip the y axis here,
          // at the boundary, so no JS consumer ever has to know about it.
          "y": 1.0 - box.origin.y - box.height,
          "width": box.width,
          "height": box.height,
        ]
      }
    }

    // Garment-level segmentation for one selected person.
    //
    // Apple Vision has no built-in garment classifier — person segmentation
    // (VNGeneratePersonSegmentationRequest) gives a person mask, but slicing
    // that mask into "jacket / pants / shoes" requires a CoreML clothing
    // model that hasn't been selected/validated yet (flagged in research.md
    // §3 as a build-time validation task). Until that model lands, this
    // throws a typed error so the caller falls back to the cloud path —
    // failing fast and visibly beats silently returning zero garments and
    // making users think their outfit wasn't recognized.
    AsyncFunction("segmentGarments") { (_ photoUri: URL, _ personRegion: [String: Double]) -> [[String: Any]] in
      throw GarmentModelUnavailableException()
    }
  }
}

private final class InvalidPhotoException: GenericException<String> {
  override var reason: String {
    "Could not load a readable image at path: \(param)"
  }
}

private final class GarmentModelUnavailableException: Exception {
  override var reason: String {
    "On-device garment segmentation requires a CoreML clothing model that is not yet bundled; use the cloud segmentation path"
  }
}
