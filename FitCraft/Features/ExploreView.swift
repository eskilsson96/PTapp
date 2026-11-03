import SwiftUI
import SwiftData
import MapKit
import Charts

struct ExploreView: View {
    let profile: UserProfile
    @Environment(\.modelContext) private var context
    @Environment(LocationService.self) private var location
    @Query(sort: \Route.cachedAt, order: .reverse) private var routes: [Route]
    @State private var service = MapService()
    @State private var position: MapCameraPosition = .automatic
    @State private var kilometers = 5.0
    @State private var selectedRoute: Route?
    @State private var showWorkout = false
    @State private var showSegment = false
    @State private var error: String?
    @State private var activity: ActivityKind = .running

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Map(position: $position) {
                    UserAnnotation()
                    if let selectedRoute {
                        MapPolyline(coordinates: selectedRoute.points.map(\.coordinate)).stroke(FC.lime, lineWidth: 6)
                        if let start = selectedRoute.points.first { Annotation("Start", coordinate: start.coordinate) { Image(systemName: "flag.fill").padding(10).background(FC.lime, in: Circle()).foregroundStyle(.black) } }
                    }
                    ForEach(service.places) { place in
                        Annotation(place.name, coordinate: place.coordinate) {
                            Button { place.mapItem.openInMaps() } label: { Image(systemName: "tree.fill").padding(10).background(FC.card, in: Circle()).foregroundStyle(FC.lime) }.accessibilityLabel("Open \(place.name) in Maps")
                        }
                    }
                }
                .mapStyle(.standard(elevation: .realistic))
                .mapControls { MapCompass(); MapScaleView(); MapUserLocationButton() }
                .frame(height: 330).clipShape(RoundedRectangle(cornerRadius: 24))

                HStack {
                    Button("Locate me", systemImage: "location.fill") { location.locate() }.buttonStyle(.bordered)
                    Spacer()
                    if service.busy { ProgressView() }
                }
                if let message = location.message { Text(message).font(.subheadline).foregroundStyle(.orange) }
                if let message = service.error { Text(message).font(.subheadline).foregroundStyle(.orange) }
                Card {
                    SectionTitle(title: "Take the scenic way.", subtitle: "Discover a loop from your current location")
                    HStack { Text("Target distance"); Spacer(); Text("\(kilometers, specifier: "%.0f") km").foregroundStyle(FC.lime).bold() }
                    Slider(value: $kilometers, in: 2...15, step: 1)
                    PrimaryButton(title: service.busy ? "Finding paths…" : "Build a running loop", symbol: "arrow.triangle.turn.up.right.diamond.fill") {
                        guard let coordinate = location.latest?.coordinate else { location.locate(); return }
                        Task {
                            if let route = await service.generateLoop(start: coordinate, kilometers: kilometers) {
                                context.insert(route)
                                do { try context.save(); selectedRoute = route; position = .automatic }
                                catch { context.rollback(); self.error = error.localizedDescription }
                            }
                        }
                    }.disabled(service.busy)
                    Text("Uses Apple walking directions. Actual distance varies; paths may overlap. Check access and conditions before heading out. Cycling-specific routing is not included.").font(.caption).foregroundStyle(FC.muted)
                }
                if let route = selectedRoute {
                    Card {
                        HStack { Text(route.name).font(.headline); Spacer(); Image(systemName: "arrow.down.circle.fill").foregroundStyle(FC.lime) }
                        Text("Saved for offline route viewing · base map tiles need a connection").font(.caption).foregroundStyle(FC.muted)
                        if !route.turnInstructions.isEmpty {
                            DisclosureGroup("Directions preview") {
                                ForEach(Array(route.turnInstructions.enumerated()), id: \.offset) { index, instruction in Text("\(index + 1). \(instruction)").font(.subheadline).frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 4) }
                            }
                        }
                        Button("Create a segment on this route", systemImage: "flag.checkered") { showSegment = true }
                    }
                }
                SectionTitle(title: "Nearby places")
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack {
                        ForEach(["Running trails", "Outdoor gym", "Athletics track", "Park"], id: \.self) { query in
                            Button(query) {
                                guard let coordinate = location.latest?.coordinate else { location.locate(); return }
                                Task { await service.discover(near: coordinate, query: query); position = .automatic }
                            }.buttonStyle(.bordered).disabled(service.busy)
                        }
                    }
                }
                if !routes.isEmpty {
                    SectionTitle(title: "Your saved routes")
                    ForEach(routes) { route in
                        Button { selectedRoute = route; position = .automatic } label: {
                            Card { HStack { Image(systemName: "point.topleft.down.to.point.bottomright.curvepath").foregroundStyle(FC.lime); Text(route.name).foregroundStyle(.primary); Spacer(); Text("\(route.distanceMeters / 1000, specifier: "%.1f") km").foregroundStyle(FC.muted) } }
                        }.buttonStyle(.plain)
                    }
                }
                Card {
                    Picker("Activity", selection: $activity) { ForEach(ActivityKind.allCases, id: \.self) { Text($0.rawValue.capitalized).tag($0) } }.pickerStyle(.segmented)
                    PrimaryButton(title: "Start outdoor workout", symbol: "play.fill") { showWorkout = true }
                }
            }.padding(20)
        }
        .navigationTitle("Explore").fitCraftScreen()
        .task { location.locate() }
        .onChange(of: location.latest) { _, latest in
            if selectedRoute == nil, let coordinate = latest?.coordinate { position = .region(MKCoordinateRegion(center: coordinate, latitudinalMeters: 3000, longitudinalMeters: 3000)) }
        }
        .sheet(isPresented: $showSegment) { if let selectedRoute { NavigationStack { SegmentEditor(route: selectedRoute) } } }
        .fullScreenCover(isPresented: $showWorkout) { OutdoorWorkoutView(profile: profile, activity: activity, route: selectedRoute, segment: nil) }
        .alert("Couldn’t save route", isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) { Button("OK") { error = nil } } message: { Text(error ?? "") }
    }
}

struct SegmentEditor: View {
    let route: Route
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var start = 0.0
    @State private var finish = 1.0
    @State private var error: String?
    private var selectedPoints: [RoutePoint] {
        guard route.points.count > 1 else { return [] }
        let first = Int(start * Double(route.points.count - 1))
        let last = max(first + 1, Int(finish * Double(route.points.count - 1)))
        return Array(route.points[first...min(last, route.points.count - 1)])
    }
    var body: some View {
        Form {
            Section("Name your challenge") { TextField("Park loop, hill climb…", text: $name) }
            Section {
                Map {
                    MapPolyline(coordinates: selectedPoints.map(\.coordinate)).stroke(FC.lime, lineWidth: 5)
                    if let first = selectedPoints.first { Marker("Start", systemImage: "flag", coordinate: first.coordinate).tint(.green) }
                    if let last = selectedPoints.last { Marker("Finish", systemImage: "flag.checkered", coordinate: last.coordinate).tint(.orange) }
                }.frame(height: 230)
                Text("Start along route: \(Int(start * 100))%")
                Slider(value: $start, in: 0...0.9, step: 0.05).onChange(of: start) { _, value in finish = max(finish, value + 0.1) }
                Text("Finish along route: \(Int(finish * 100))%")
                Slider(value: $finish, in: (start + 0.1)...1, step: 0.05)
                Text("\(Geometry.length(selectedPoints) / 1000, specifier: "%.2f") km · 20 m start/finish gates")
            } footer: { Text("GPS progress must follow the course in order. Short segments under 100 m cannot be saved.") }
            if let error { Text(error).foregroundStyle(.orange) }
            Button("Save segment") { save() }.disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || Geometry.length(selectedPoints) < 100)
        }.navigationTitle("Create segment").toolbar { Button("Cancel") { dismiss() } }
    }
    private func save() {
        guard let first = selectedPoints.first, let last = selectedPoints.last else { return }
        let segment = Segment(name: name.trimmingCharacters(in: .whitespaces), activity: route.activity, start: first, finish: last, points: selectedPoints, distanceMeters: Geometry.length(selectedPoints))
        segment.route = route
        context.insert(segment)
        do { try context.save(); dismiss() } catch { context.rollback(); self.error = error.localizedDescription }
    }
}
