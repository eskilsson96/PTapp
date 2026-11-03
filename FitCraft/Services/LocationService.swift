import Foundation
import CoreLocation
import CoreMotion
import Observation

@MainActor @Observable
final class LocationService: NSObject, @preconcurrency CLLocationManagerDelegate {
    var latest: CLLocation?
    var authorization: CLAuthorizationStatus = .notDetermined
    var message: String?
    var steps = 0
    var onLocation: ((CLLocation) -> Void)?
    private let manager = CLLocationManager()
    private let pedometer = CMPedometer()
    private var tracking = false

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.distanceFilter = 5
        authorization = manager.authorizationStatus
    }

    func locate() {
        message = nil
        switch manager.authorizationStatus {
        case .notDetermined: manager.requestWhenInUseAuthorization()
        case .authorizedAlways, .authorizedWhenInUse: manager.requestLocation()
        default: message = "Enable location for FitCraft in iPhone Settings to find nearby routes."
        }
    }

    func start(activity: ActivityKind) {
        tracking = true
        steps = 0
        manager.activityType = activity == .cycling ? .otherNavigation : .fitness
        manager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
        manager.pausesLocationUpdatesAutomatically = false
        manager.allowsBackgroundLocationUpdates = true
        manager.showsBackgroundLocationIndicator = true
        manager.startUpdatingLocation()
        if CMPedometer.isStepCountingAvailable(), activity != .cycling {
            pedometer.startUpdates(from: .now) { [weak self] data, _ in
                let count = data?.numberOfSteps.intValue ?? 0
                Task { @MainActor [weak self] in self?.steps = count }
            }
        }
    }

    func stop() {
        tracking = false
        manager.stopUpdatingLocation()
        manager.allowsBackgroundLocationUpdates = false
        manager.desiredAccuracy = kCLLocationAccuracyBest
        pedometer.stopUpdates()
        onLocation = nil
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        authorization = manager.authorizationStatus
        if authorization == .authorizedWhenInUse || authorization == .authorizedAlways { manager.requestLocation() }
        if authorization == .denied || authorization == .restricted {
            message = "Location access is off. You can still view saved routes."
            if tracking { stop() }
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        for location in locations.sorted(by: { $0.timestamp < $1.timestamp }) {
            guard location.horizontalAccuracy >= 0, abs(location.timestamp.timeIntervalSinceNow) < 15 else { continue }
            latest = location
            onLocation?(location)
        }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        message = "GPS is unavailable. Move outdoors and try again."
    }
}

extension RoutePoint {
    var coordinate: CLLocationCoordinate2D { .init(latitude: latitude, longitude: longitude) }
    init(_ location: CLLocation) {
        latitude = location.coordinate.latitude
        longitude = location.coordinate.longitude
        elevationMeters = location.verticalAccuracy >= 0 ? location.altitude : nil
        recordedAt = location.timestamp
    }
}
