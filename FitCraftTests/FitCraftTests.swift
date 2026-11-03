import XCTest
import SwiftData
@testable import FitCraft

final class FitCraftTests: XCTestCase {
    func testVeganPlanContainsNoAnimalProducts() {
        let meals = PlanningEngine.meals(restrictions: ["Vegan"])
        let ingredients = meals.flatMap(\.ingredients).map(\.name)
        XCTAssertEqual(meals.count, 3)
        XCTAssertTrue(ingredients.contains("Firm tofu"))
        XCTAssertTrue(ingredients.contains("Soy yogurt"))
        XCTAssertFalse(ingredients.contains("Chicken breast"))
        XCTAssertFalse(ingredients.contains("Skyr"))
    }

    func testBodyweightPlanDoesNotRequireEquipment() {
        let plan = PlanningEngine.workout(gym: false, equipment: [], level: .beginner, completedSessions: 0)
        XCTAssertTrue(plan.contains { $0.name == "Bodyweight squat" })
        XCTAssertTrue(plan.contains { $0.name == "Glute bridge" })
        XCTAssertFalse(plan.contains { $0.name.contains("Dumbbell") || $0.name.contains("cable") })
    }

    func testDistanceAndResampling() {
        let a = RoutePoint(latitude: 0, longitude: 0)
        let b = RoutePoint(latitude: 0.001, longitude: 0)
        XCTAssertEqual(Geometry.distance(a, b), 111.195, accuracy: 0.1)
        let points = Geometry.resample([a, b])
        XCTAssertEqual(Geometry.length(points), Geometry.distance(a, b), accuracy: 0.1)
        XCTAssertGreaterThan(points.count, 2)
    }

    func testSegmentRequiresFullOrderedCourse() {
        let a = RoutePoint(latitude: 0, longitude: 0)
        let b = RoutePoint(latitude: 0.002, longitude: 0)
        let start = Date(timeIntervalSince1970: 1_000)
        var matcher = SegmentMatcher(points: [a, b], radius: 20)
        XCTAssertNotNil(matcher.update(point: a, accuracy: 5, time: start))
        XCTAssertNil(matcher.update(point: b, accuracy: 5, time: start.addingTimeInterval(2)))
        XCTAssertFalse(matcher.finished, "A jump to the finish cannot complete the course")
        for (index, point) in Geometry.resample([a, b]).enumerated() {
            _ = matcher.update(point: point, accuracy: 5, time: start.addingTimeInterval(Double(index + 3)))
        }
        XCTAssertTrue(matcher.finished)
    }

    func testLoopDoesNotFinishWhileStandingAtStart() {
        let a = RoutePoint(latitude: 0, longitude: 0)
        let b = RoutePoint(latitude: 0.002, longitude: 0)
        var matcher = SegmentMatcher(points: [a, b, a], radius: 20)
        for index in 0..<100 { _ = matcher.update(point: a, accuracy: 5, time: Date(timeIntervalSince1970: Double(index))) }
        XCTAssertFalse(matcher.finished)
        XCTAssertLessThan(matcher.progress, 0.5)
    }

    func testPoorAccuracyCannotStartSegment() {
        let a = RoutePoint(latitude: 0, longitude: 0)
        var matcher = SegmentMatcher(points: [a, RoutePoint(latitude: 0.002, longitude: 0)], radius: 20)
        XCTAssertNil(matcher.update(point: a, accuracy: 100, time: .now))
        XCTAssertNil(matcher.beganAt)
    }

    @MainActor func testPersistenceAndDeletionRules() throws {
        let container = try FitCraftPersistence.makeContainer(inMemory: true)
        let context = ModelContext(container)
        let user = UserProfile(displayName: "Runner")
        let a = RoutePoint(latitude: 59.3, longitude: 18)
        let b = RoutePoint(latitude: 59.31, longitude: 18)
        let route = Route(name: "Test", activity: .running, points: [a, b], distanceMeters: 1112)
        let segment = Segment(name: "Hill", activity: .running, start: a, finish: b, points: [a, b], distanceMeters: 1112)
        segment.route = route
        context.insert(user)
        context.insert(route)
        context.insert(segment)
        let attempt = SegmentAttempt(athlete: user, segment: segment)
        attempt.elapsedSeconds = 300
        attempt.distanceMeters = 1000
        context.insert(attempt)
        try context.save()
        XCTAssertEqual(try context.fetch(FetchDescriptor<SegmentAttempt>()).count, 1)
        XCTAssertEqual(attempt.paceSecondsPerKilometer, 300)
        context.delete(route)
        try context.save()
        XCTAssertEqual(try context.fetch(FetchDescriptor<Segment>()).count, 1)
        XCTAssertNil(segment.route)
        context.delete(segment)
        try context.save()
        XCTAssertEqual(try context.fetch(FetchDescriptor<SegmentAttempt>()).count, 0)
        XCTAssertEqual(try context.fetch(FetchDescriptor<UserProfile>()).count, 1)
    }
}
