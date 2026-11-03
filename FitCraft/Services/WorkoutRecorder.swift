import Foundation
import CoreLocation
import Observation
import AVFoundation

@MainActor @Observable
final class WorkoutRecorder {
    var running = false
    var startedAt: Date?
    var points: [RoutePoint] = []
    var distance = 0.0
    var segmentProgress = 0.0
    var segmentStartedAt: Date?
    var segmentResult: Double?
    var cue = 0
    var status = "Waiting for GPS"
    private var matcher: SegmentMatcher?
    private var lastLocation: CLLocation?
    private var activity: ActivityKind = .running
    private let speaker = AVSpeechSynthesizer()

    func start(location: LocationService, activity: ActivityKind, segment: Segment?) {
        self.activity = activity
        running = true
        startedAt = .now
        points = []
        distance = 0
        lastLocation = nil
        segmentResult = nil
        segmentProgress = 0
        segmentStartedAt = nil
        matcher = segment.map { SegmentMatcher(points: $0.points, radius: $0.gateRadiusMeters) }
        status = segment == nil ? "Recording your adventure" : "Head to the segment start"
        location.onLocation = { [weak self] point in self?.ingest(point) }
        location.start(activity: activity)
    }

    private func ingest(_ location: CLLocation) {
        guard running, location.horizontalAccuracy <= 25, location.horizontalAccuracy >= 0 else { status = "Waiting for a more accurate GPS signal"; return }
        if let lastLocation {
            let elapsed = location.timestamp.timeIntervalSince(lastLocation.timestamp)
            guard elapsed > 0 else { return }
            let increment = location.distance(from: lastLocation)
            let limit = activity == .cycling ? 35.0 : 13.0
            guard increment / elapsed <= limit else { status = "GPS jump ignored"; return }
            // A long GPS gap cannot provide a reliable segment result.
            if elapsed > 20 {
                matcher = nil
                segmentStartedAt = nil
                status = "GPS gap · segment timing cancelled"
            } else { distance += increment }
        }
        lastLocation = location
        let point = RoutePoint(location)
        points.append(point)
        guard var currentMatcher = matcher else { return }
        let event = currentMatcher.update(point: point, accuracy: location.horizontalAccuracy, time: location.timestamp)
        matcher = currentMatcher
        segmentProgress = currentMatcher.progress
        segmentStartedAt = currentMatcher.beganAt
        switch event {
        case .started: announce("Segment started"); status = "Segment in progress"
        case .finished(let seconds): segmentResult = seconds; announce("Segment complete"); status = "Segment complete · \(Display.duration(seconds))"
        case nil: break
        }
    }

    func stop(location: LocationService) -> OutdoorSession? {
        guard running, let startedAt else { return nil }
        running = false
        location.stop()
        return OutdoorSession(startedAt: startedAt, finishedAt: .now, activity: activity, distanceMeters: distance, points: points)
    }

    private func announce(_ text: String) {
        cue += 1
        speaker.speak(AVSpeechUtterance(string: text))
    }
}
