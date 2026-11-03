import Foundation
import SwiftData

// Store coordinates as values; MapKit types belong in the presentation layer.
struct RoutePoint: Codable, Hashable, Sendable {
    var latitude: Double
    var longitude: Double
    var elevationMeters: Double?
    var recordedAt: Date?
}

enum FitnessLevel: String, Codable, CaseIterable, Sendable {
    case beginner, intermediate, advanced
}

enum ActivityKind: String, Codable, CaseIterable, Sendable {
    case running, cycling, walking
}

enum ProfileSex: String, Codable, CaseIterable {
    case female, male, unspecified
}

enum Equipment: String, Codable, CaseIterable, Sendable {
    case dumbbells, barbell, bench, resistanceBands, pullUpBar, kettlebell
}

@Model
final class UserProfile {
    @Attribute(.unique) var id: UUID
    var displayName: String
    var birthDate: Date?
    var sex: ProfileSex
    var currentWeightKg: Double?
    var targetWeightKg: Double?
    var targetDate: Date?
    var hasGymMembership: Bool
    var equipment: [Equipment]
    var fitnessLevel: FitnessLevel
    var injuryNotes: String
    var weeklyFoodBudget: Decimal
    /// ISO 4217 code: SEK, EUR, USD, etc.
    var currencyCode: String
    var dietaryRestrictions: [String]
    var dailyProteinGrams: Double
    var dailyCarbohydrateGrams: Double
    var dailyFatGrams: Double
    var createdAt: Date

    @Relationship(deleteRule: .cascade, inverse: \SegmentAttempt.athlete)
    var attempts: [SegmentAttempt] = []

    init(id: UUID = UUID(), displayName: String, currencyCode: String = "SEK") {
        self.id = id
        self.displayName = displayName
        self.sex = .unspecified
        self.hasGymMembership = false
        self.equipment = []
        self.fitnessLevel = .beginner
        self.injuryNotes = ""
        self.weeklyFoodBudget = 0
        self.currencyCode = currencyCode
        self.dietaryRestrictions = []
        self.dailyProteinGrams = 0
        self.dailyCarbohydrateGrams = 0
        self.dailyFatGrams = 0
        self.createdAt = .now
    }
}

@Model
final class Route {
    @Attribute(.unique) var id: UUID
    var name: String
    var activity: ActivityKind
    var points: [RoutePoint]
    var distanceMeters: Double
    var elevationGainMeters: Double?
    var isLoop: Bool
    var cachedAt: Date
    var turnInstructions: [String]

    @Relationship(deleteRule: .nullify, inverse: \Segment.route)
    var segments: [Segment] = []

    init(id: UUID = UUID(), name: String, activity: ActivityKind,
         points: [RoutePoint], distanceMeters: Double, isLoop: Bool = false) {
        self.id = id
        self.name = name
        self.activity = activity
        self.points = points
        self.distanceMeters = distanceMeters
        self.isLoop = isLoop
        self.cachedAt = .now
        self.turnInstructions = []
    }
}

@Model
final class Segment {
    @Attribute(.unique) var id: UUID
    var name: String
    var activity: ActivityKind
    var start: RoutePoint
    var finish: RoutePoint
    /// Full course geometry is required to validate a lap or hill attempt.
    var points: [RoutePoint]
    var distanceMeters: Double
    var gateRadiusMeters: Double
    var createdAt: Date
    var route: Route?

    @Relationship(deleteRule: .cascade, inverse: \SegmentAttempt.segment)
    var attempts: [SegmentAttempt] = []
    @Relationship(deleteRule: .cascade, inverse: \LeaderboardEntry.segment)
    var leaderboardEntries: [LeaderboardEntry] = []

    init(id: UUID = UUID(), name: String, activity: ActivityKind,
         start: RoutePoint, finish: RoutePoint, points: [RoutePoint],
         distanceMeters: Double, gateRadiusMeters: Double = 20) {
        self.id = id
        self.name = name
        self.activity = activity
        self.start = start
        self.finish = finish
        self.points = points
        self.distanceMeters = distanceMeters
        self.gateRadiusMeters = gateRadiusMeters
        self.createdAt = .now
    }
}

enum AttemptStatus: String, Codable, CaseIterable {
    case recording, pendingValidation, accepted, rejected
}

@Model
final class SegmentAttempt {
    @Attribute(.unique) var id: UUID
    var athlete: UserProfile?
    var segment: Segment?
    var startedAt: Date
    var finishedAt: Date?
    /// Elapsed time includes pauses; only completed, validated attempts rank.
    var elapsedSeconds: Double?
    var distanceMeters: Double
    var averageHeartRateBPM: Double?
    var track: [RoutePoint]
    var status: AttemptStatus
    var healthKitWorkoutID: UUID?
    var uploadedAt: Date?

    var averageSpeedMetersPerSecond: Double? {
        guard let elapsedSeconds, elapsedSeconds > 0, distanceMeters > 0 else { return nil }
        return distanceMeters / elapsedSeconds
    }

    var paceSecondsPerKilometer: Double? {
        guard let elapsedSeconds, elapsedSeconds > 0, distanceMeters > 0 else { return nil }
        return elapsedSeconds / (distanceMeters / 1_000)
    }

    init(id: UUID = UUID(), athlete: UserProfile, segment: Segment,
         startedAt: Date = .now) {
        self.id = id
        self.athlete = athlete
        self.segment = segment
        self.startedAt = startedAt
        self.distanceMeters = 0
        self.track = []
        self.status = .recording
    }
}

enum LeaderboardPeriod: String, Codable, CaseIterable {
    case allTime, monthly
}

/// Offline cache of a server-authoritative leaderboard, not a local crown claim.
@Model
final class LeaderboardEntry {
    @Attribute(.unique) var id: UUID
    var segment: Segment?
    var athleteID: UUID
    var attemptID: UUID
    var displayName: String
    var avatarURL: URL?
    var elapsedSeconds: Double
    var achievedAt: Date
    var rank: Int
    var period: LeaderboardPeriod
    /// UTC first day of month for monthly boards; nil for all-time.
    var periodStart: Date?
    var fetchedAt: Date

    var holdsCrown: Bool { period == .allTime && rank == 1 }

    init(id: UUID, segment: Segment, athleteID: UUID, attemptID: UUID,
         displayName: String, elapsedSeconds: Double, achievedAt: Date,
         rank: Int, period: LeaderboardPeriod, periodStart: Date? = nil) {
        self.id = id
        self.segment = segment
        self.athleteID = athleteID
        self.attemptID = attemptID
        self.displayName = displayName
        self.elapsedSeconds = elapsedSeconds
        self.achievedAt = achievedAt
        self.rank = rank
        self.period = period
        self.periodStart = periodStart
        self.fetchedAt = .now
    }
}

enum FitCraftPersistence {
    @MainActor
    static func makeContainer(inMemory: Bool = false) throws -> ModelContainer {
        let schema = Schema([
            UserProfile.self, Route.self, Segment.self,
            SegmentAttempt.self, LeaderboardEntry.self, DailyLog.self, OutdoorSession.self
        ])
        let configuration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: inMemory, cloudKitDatabase: .none)
        return try ModelContainer(for: schema, configurations: [configuration])
    }
}

@Model
final class DailyLog {
    @Attribute(.unique) var id: UUID
    var date: Date
    var workoutCompleted: Bool
    var completedMealIDs: [String]
    var mealSnapshots: [MealSnapshot]
    var protein: Double
    var carbs: Double
    var fat: Double

    init(date: Date = .now) {
        id = UUID()
        self.date = Calendar.current.startOfDay(for: date)
        workoutCompleted = false
        completedMealIDs = []
        mealSnapshots = []
        protein = 0
        carbs = 0
        fat = 0
    }
}

struct MealSnapshot: Codable, Sendable {
    var mealID: String
    var protein: Double
    var carbs: Double
    var fat: Double
}

@Model
final class OutdoorSession {
    @Attribute(.unique) var id: UUID
    var startedAt: Date
    var finishedAt: Date
    var activity: ActivityKind
    var distanceMeters: Double
    var points: [RoutePoint]
    var healthKitWorkoutID: UUID?

    init(startedAt: Date, finishedAt: Date, activity: ActivityKind, distanceMeters: Double, points: [RoutePoint]) {
        id = UUID()
        self.startedAt = startedAt
        self.finishedAt = finishedAt
        self.activity = activity
        self.distanceMeters = distanceMeters
        self.points = points
    }
}
