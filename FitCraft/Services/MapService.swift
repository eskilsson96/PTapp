import Foundation
import MapKit
import Observation

struct NearbyPlace: Identifiable {
    let id = UUID()
    let name: String
    let coordinate: CLLocationCoordinate2D
    let mapItem: MKMapItem
}

@MainActor @Observable
final class MapService {
    var busy = false
    var error: String?
    var places: [NearbyPlace] = []

    func discover(near coordinate: CLLocationCoordinate2D, query: String) async {
        busy = true
        error = nil
        defer { busy = false }
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = query
        request.region = MKCoordinateRegion(center: coordinate, latitudinalMeters: 8_000, longitudinalMeters: 8_000)
        do {
            let response = try await MKLocalSearch(request: request).start()
            places = response.mapItems.map { NearbyPlace(name: $0.name ?? "Outdoor place", coordinate: $0.placemark.coordinate, mapItem: $0) }
            if places.isEmpty { error = "No matches nearby. Try a different activity." }
        } catch { self.error = error.localizedDescription }
    }

    func generateLoop(start: CLLocationCoordinate2D, kilometers: Double) async -> Route? {
        busy = true
        error = nil
        defer { busy = false }
        // Walking directions follow mapped paths. Target length is approximate.
        let radius = kilometers * 1_000 / 4.2
        let north = CLLocationCoordinate2D(latitude: start.latitude + radius / 111_000, longitude: start.longitude)
        let east = CLLocationCoordinate2D(latitude: start.latitude + radius * 0.4 / 111_000, longitude: start.longitude + radius * 0.8 / (111_000 * max(0.1, cos(start.latitude * .pi / 180))))
        let waypoints = [start, north, east, start]
        var points: [RoutePoint] = []
        var instructions: [String] = []
        var distance = 0.0
        do {
            for (a, b) in zip(waypoints, waypoints.dropFirst()) {
                try Task.checkCancellation()
                let request = MKDirections.Request()
                request.source = MKMapItem(placemark: MKPlacemark(coordinate: a))
                request.destination = MKMapItem(placemark: MKPlacemark(coordinate: b))
                request.transportType = .walking
                let directions = MKDirections(request: request)
                let response = try await directions.calculate()
                guard let leg = response.routes.first else { throw MapFailure.noRoute }
                var coordinates = [CLLocationCoordinate2D](repeating: .init(), count: leg.polyline.pointCount)
                leg.polyline.getCoordinates(&coordinates, range: NSRange(location: 0, length: coordinates.count))
                points += coordinates.map { RoutePoint(latitude: $0.latitude, longitude: $0.longitude) }
                distance += leg.distance
                instructions += leg.steps.filter { !$0.instructions.isEmpty }.map { $0.instructions }
            }
            guard points.count > 2, distance > 100 else { throw MapFailure.noRoute }
            let route = Route(name: "\(String(format: "%.1f", distance / 1000)) km discovery loop", activity: .running, points: points, distanceMeters: distance, isLoop: true)
            route.turnInstructions = instructions
            return route
        } catch is CancellationError { return nil }
        catch { self.error = "Couldn’t find a connected walking loop here. Try a shorter distance or another location. \(error.localizedDescription)"; return nil }
    }

    enum MapFailure: LocalizedError {
        case noRoute
        var errorDescription: String? { "No mapped path was returned." }
    }
}
