import Foundation

enum Geometry {
    static func distance(_ a: RoutePoint, _ b: RoutePoint) -> Double {
        let radians = Double.pi / 180
        let lat = (b.latitude - a.latitude) * radians
        let lon = (b.longitude - a.longitude) * radians
        let h = pow(sin(lat / 2), 2) + cos(a.latitude * radians) * cos(b.latitude * radians) * pow(sin(lon / 2), 2)
        return 6_371_000 * 2 * atan2(sqrt(max(0, h)), sqrt(max(0, 1 - h)))
    }

    static func length(_ points: [RoutePoint]) -> Double {
        zip(points, points.dropFirst()).reduce(0) { $0 + distance($1.0, $1.1) }
    }

    static func resample(_ points: [RoutePoint], spacing: Double = 15) -> [RoutePoint] {
        guard points.count > 1, spacing > 0 else { return points }
        var result = [points[0]]
        for (a, b) in zip(points, points.dropFirst()) {
            let steps = max(1, Int(ceil(distance(a, b) / spacing)))
            for step in 1...steps {
                let f = Double(step) / Double(steps)
                result.append(RoutePoint(latitude: a.latitude + (b.latitude - a.latitude) * f, longitude: a.longitude + (b.longitude - a.longitude) * f))
            }
        }
        return result
    }
}

/// Local practice timing only. Global competition requires server validation.
struct SegmentMatcher {
    enum Event { case started, finished(TimeInterval) }
    private(set) var beganAt: Date?
    private(set) var progress: Double = 0
    private(set) var finished = false
    private var nextCheckpoint = 0
    private var leftStart = false
    private let course: [RoutePoint]
    private let radius: Double

    init(points: [RoutePoint], radius: Double) {
        course = Geometry.resample(points)
        self.radius = radius
    }

    mutating func update(point: RoutePoint, accuracy: Double, time: Date) -> Event? {
        guard course.count > 1, accuracy >= 0, accuracy <= 25, !finished else { return nil }
        if beganAt == nil {
            guard Geometry.distance(point, course[0]) <= radius else { return nil }
            beganAt = time
            nextCheckpoint = 1
            return .started
        }
        if Geometry.distance(point, course[0]) > radius * 1.5 { leftStart = true }
        // Advance in course order. A GPS jump cannot skip an unvisited checkpoint.
        while nextCheckpoint < course.count && Geometry.distance(point, course[nextCheckpoint]) < max(radius, 30) {
            nextCheckpoint += 1
        }
        progress = min(1, Double(nextCheckpoint) / Double(course.count))
        if leftStart, nextCheckpoint == course.count, Geometry.distance(point, course[course.count - 1]) <= radius,
           let beganAt, time > beganAt {
            finished = true
            return .finished(time.timeIntervalSince(beganAt))
        }
        return nil
    }
}
