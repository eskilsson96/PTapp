import SwiftUI
import SwiftData
import MapKit
import Charts

struct OutdoorWorkoutView: View {
    let profile: UserProfile
    let activity: ActivityKind
    let route: Route?
    let segment: Segment?
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @Environment(LocationService.self) private var location
    @Environment(HealthService.self) private var health
    @State private var recorder = WorkoutRecorder()
    @State private var confirmStop = false
    @State private var saved = false
    @State private var pendingSession: OutdoorSession?
    @State private var error: String?
    @State private var exportMessage: String?
    @State private var exporting = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    Map {
                        UserAnnotation()
                        if let route { MapPolyline(coordinates: route.points.map(\.coordinate)).stroke(.white.opacity(0.6), lineWidth: 4) }
                        if let segment { MapPolyline(coordinates: segment.points.map(\.coordinate)).stroke(.orange, lineWidth: 6) }
                        MapPolyline(coordinates: recorder.points.map(\.coordinate)).stroke(FC.lime, lineWidth: 6)
                    }.frame(height: 280).clipShape(RoundedRectangle(cornerRadius: 24))
                    TimelineView(.periodic(from: .now, by: 1)) { timeline in
                        let elapsed = (pendingSession?.finishedAt ?? timeline.date).timeIntervalSince(recorder.startedAt ?? timeline.date)
                        VStack(spacing: 20) {
                            Text(Display.pace(distance: recorder.distance, seconds: elapsed)).font(.system(size: 64, weight: .heavy, design: .rounded)).monospacedDigit().minimumScaleFactor(0.6)
                            Text("AVERAGE PACE · MIN / KM").font(.caption.bold()).tracking(1.5).foregroundStyle(FC.muted)
                            HStack { Metric(value: String(format: "%.2f", recorder.distance / 1000), label: "Kilometers"); Metric(value: Display.duration(elapsed), label: "Elapsed"); Metric(value: recentHeartRate(at: timeline.date), label: "Heart rate") }
                            if let segment {
                                Card {
                                    Label(segment.name, systemImage: "flag.checkered").font(.headline)
                                    ProgressView(value: recorder.segmentProgress)
                                    if let start = recorder.segmentStartedAt { Text(Display.duration(recorder.segmentResult ?? timeline.date.timeIntervalSince(start))).font(.largeTitle.monospacedDigit().bold()) }
                                    Text(recorder.status).font(.subheadline).foregroundStyle(FC.lime)
                                }
                            }
                        }
                    }
                    Text("\(location.steps) steps · Heart rate requires a recent Health sample from a compatible sensor.").font(.caption).foregroundStyle(FC.muted)
                    if let message = location.message { Text(message).foregroundStyle(.orange) }
                    if let pendingSession, !recorder.running {
                        if saved {
                            Label("Workout saved on this iPhone", systemImage: "checkmark.circle.fill").foregroundStyle(FC.lime)
                            if let exportMessage { Text(exportMessage).font(.caption).foregroundStyle(FC.muted) }
                            if health.connected, pendingSession.healthKitWorkoutID == nil {
                                Button(exporting ? "Saving to Health…" : "Save workout to Apple Health") { export(pendingSession) }.buttonStyle(.bordered).disabled(exporting)
                            }
                            elevationChart(pendingSession)
                            PrimaryButton(title: "Done", symbol: "checkmark") { dismiss() }.disabled(exporting)
                        } else { PrimaryButton(title: "Retry saving workout", symbol: "arrow.clockwise") { persist(pendingSession) } }
                    } else if recorder.running {
                        Button(role: .destructive) { confirmStop = true } label: { Label("Finish workout", systemImage: "stop.fill").font(.headline).frame(maxWidth: .infinity).padding(18) }.buttonStyle(.bordered)
                    } else {
                        PrimaryButton(title: "Start \(activity.rawValue)", symbol: "play.fill") {
                            guard location.authorization == .authorizedAlways || location.authorization == .authorizedWhenInUse else { location.locate(); return }
                            recorder.start(location: location, activity: activity, segment: segment)
                        }
                        Text("GPS runs in the background during your workout. Keep FitCraft running; force-quitting ends tracking.").font(.caption).foregroundStyle(FC.muted)
                    }
                }.padding(20)
            }.navigationTitle(activity.rawValue.capitalized).navigationBarTitleDisplayMode(.inline).fitCraftScreen()
                .toolbar { if !recorder.running && pendingSession == nil { Button("Close") { dismiss() } } }
                .confirmationDialog("Finish and save this workout?", isPresented: $confirmStop, titleVisibility: .visible) { Button("Finish workout") { if let session = recorder.stop(location: location) { pendingSession = session; persist(session) } } }
                .sensoryFeedback(.success, trigger: recorder.cue)
                .alert("Couldn’t save workout", isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) { Button("OK") { error = nil } } message: { Text(error ?? "") }
                .task { location.locate() }
                .task {
                    while !Task.isCancelled {
                        await health.refreshHeartRate()
                        do { try await Task.sleep(for: .seconds(15)) } catch { return }
                    }
                }
                .onDisappear { if recorder.running { _ = recorder.stop(location: location) } }
        }.interactiveDismissDisabled(recorder.running || exporting || (pendingSession != nil && !saved))
    }

    private func recentHeartRate(at date: Date) -> String {
        guard let rate = health.heartRate, let measured = health.heartRateDate, date.timeIntervalSince(measured) < 60 else { return "—" }
        return "\(Int(rate))"
    }

    private func persist(_ session: OutdoorSession) {
        context.insert(session)
        if let segment, let elapsed = recorder.segmentResult, let began = recorder.segmentStartedAt {
            let attempt = SegmentAttempt(athlete: profile, segment: segment, startedAt: began)
            attempt.finishedAt = began.addingTimeInterval(elapsed)
            attempt.elapsedSeconds = elapsed
            attempt.distanceMeters = segment.distanceMeters
            attempt.track = session.points.filter { point in guard let date = point.recordedAt else { return false }; return date >= began && date <= began.addingTimeInterval(elapsed) }
            attempt.status = .pendingValidation
            context.insert(attempt)
        }
        do { try context.save(); saved = true } catch { context.rollback(); self.error = error.localizedDescription }
    }

    private func export(_ session: OutdoorSession) {
        exporting = true
        Task {
            defer { exporting = false }
            do {
                session.healthKitWorkoutID = try await health.save(session)
                try context.save()
                exportMessage = "Saved workout time and distance to Apple Health."
            } catch { exportMessage = "Health export failed: \(error.localizedDescription)" }
        }
    }

    private func elevationChart(_ session: OutdoorSession) -> some View {
        let samples = session.points.enumerated().filter { $0.element.elevationMeters != nil }
        return Group {
            if !samples.isEmpty {
                Card {
                    Text("Recorded elevation").font(.headline)
                    Chart(samples, id: \.offset) { entry in
                        LineMark(x: .value("Sample", entry.offset), y: .value("Altitude (m)", entry.element.elevationMeters ?? 0)).foregroundStyle(FC.lime)
                    }.frame(height: 130).chartYAxisLabel("m")
                    Text("GPS altitude is approximate.").font(.caption).foregroundStyle(FC.muted)
                }
            }
        }
    }
}
