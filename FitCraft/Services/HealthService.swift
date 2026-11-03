import Foundation
import HealthKit
import Observation

@MainActor @Observable
final class HealthService {
    var connected = false
    var heartRate: Double?
    var heartRateDate: Date?
    var message: String?
    private let store = HKHealthStore()

    func authorize() async {
        guard HKHealthStore.isHealthDataAvailable() else { message = "Health data is unavailable on this device."; return }
        let heart = HKQuantityType(.heartRate)
        do {
            try await store.requestAuthorization(toShare: [HKObjectType.workoutType()], read: [heart])
            connected = true
            message = "Health permission request completed. Read permission is private; heart rate appears only when a recent sample is available."
            await refreshHeartRate()
        } catch { message = error.localizedDescription }
    }

    func refreshHeartRate() async {
        guard connected else { return }
        let predicate = HKQuery.predicateForSamples(withStart: Date.now.addingTimeInterval(-60), end: nil)
        let sample: (Double, Date)? = await withCheckedContinuation { continuation in
            let query = HKSampleQuery(sampleType: HKQuantityType(.heartRate), predicate: predicate, limit: 1, sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)]) { _, samples, _ in
                if let sample = samples?.first as? HKQuantitySample {
                    continuation.resume(returning: (sample.quantity.doubleValue(for: HKUnit.count().unitDivided(by: .minute())), sample.endDate))
                } else { continuation.resume(returning: nil) }
            }
            store.execute(query)
        }
        heartRate = sample?.0
        heartRateDate = sample?.1
    }

    func save(_ session: OutdoorSession) async throws -> UUID? {
        guard connected else { return nil }
        let type: HKWorkoutActivityType = session.activity == .cycling ? .cycling : (session.activity == .walking ? .walking : .running)
        let workout = HKWorkout(activityType: type, start: session.startedAt, end: session.finishedAt, duration: session.finishedAt.timeIntervalSince(session.startedAt), totalEnergyBurned: nil, totalDistance: HKQuantity(unit: .meter(), doubleValue: session.distanceMeters), metadata: [HKMetadataKeyIndoorWorkout: false])
        try await store.save(workout)
        return workout.uuid
    }
}
