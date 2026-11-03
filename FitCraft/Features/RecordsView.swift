import SwiftUI
import SwiftData

struct RecordsView: View {
    @Query(sort: \Segment.createdAt, order: .reverse) private var segments: [Segment]
    @Query(sort: \OutdoorSession.startedAt, order: .reverse) private var sessions: [OutdoorSession]
    @Environment(AppCoordinator.self) private var coordinator
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                Card {
                    Image(systemName: "crown.fill").font(.system(size: 42)).foregroundStyle(FC.lime)
                    Text("Make it your hill.").font(.largeTitle.bold())
                    Text("Save a segment, follow its course, and chase your own best. Personal records stay on this iPhone.").foregroundStyle(FC.muted)
                }
                SectionTitle(title: "Your segments")
                if segments.isEmpty {
                    ContentUnavailableView("Your first challenge awaits", systemImage: "flag.checkered", description: Text("Generate a route in Explore, then create a segment."))
                    Button("Find a route") { coordinator.tab = .explore }.buttonStyle(.bordered)
                }
                ForEach(segments) { segment in
                    NavigationLink { SegmentDetailView(segment: segment) } label: {
                        Card {
                            HStack { Image(systemName: "flag.checkered").foregroundStyle(FC.lime); Text(segment.name).font(.headline).foregroundStyle(.white); Spacer(); Image(systemName: "chevron.right").foregroundStyle(FC.muted) }
                            Text("\(segment.distanceMeters / 1000, specifier: "%.2f") km · \(segment.attempts.count) attempts").font(.subheadline).foregroundStyle(FC.muted)
                        }
                    }.buttonStyle(.plain)
                }
                SectionTitle(title: "Activity journal")
                if sessions.isEmpty { Text("Your saved outdoor workouts will appear here.").foregroundStyle(FC.muted) }
                ForEach(sessions) { session in
                    Card {
                        HStack { Label(session.activity.rawValue.capitalized, systemImage: session.activity == .cycling ? "bicycle" : "figure.run").font(.headline); Spacer(); Text(session.startedAt.formatted(date: .abbreviated, time: .omitted)).font(.caption).foregroundStyle(FC.muted) }
                        HStack { Metric(value: String(format: "%.2f", session.distanceMeters / 1000), label: "km"); Metric(value: Display.duration(session.finishedAt.timeIntervalSince(session.startedAt)), label: "Time"); Metric(value: Display.pace(distance: session.distanceMeters, seconds: session.finishedAt.timeIntervalSince(session.startedAt)), label: "min/km") }
                    }
                }
            }.padding(20)
        }.navigationTitle("Records").fitCraftScreen()
    }
}

struct SegmentDetailView: View {
    let segment: Segment
    @Environment(\.modelContext) private var context
    @Query private var profiles: [UserProfile]
    @AppStorage("communityURL") private var communityURL = ""
    @State private var monthly = false
    @State private var global = false
    @State private var showWorkout = false
    @State private var loading = false
    @State private var message: String?
    @State private var crownAlert: String?
    private var local: [SegmentAttempt] {
        segment.attempts.filter {
            $0.finishedAt != nil && $0.status != .rejected && ($0.elapsedSeconds ?? 0) > 0 &&
            (!monthly || Calendar(identifier: .gregorian).isDate($0.startedAt, equalTo: .now, toGranularity: .month))
        }.sorted { ($0.elapsedSeconds ?? .infinity) < ($1.elapsedSeconds ?? .infinity) }
    }
    private var remote: [LeaderboardEntry] {
        segment.leaderboardEntries.filter { row in
            row.period == (monthly ? .monthly : .allTime) && (!monthly || row.periodStart == Self.monthStart)
        }.sorted { $0.rank < $1.rank }
    }
    private static var monthStart: Date? {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        return calendar.dateInterval(of: .month, for: .now)?.start
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Card {
                    Label("\(segment.distanceMeters / 1000, specifier: "%.2f") km · \(segment.activity.rawValue)", systemImage: "flag.checkered").foregroundStyle(FC.lime)
                    if let best = local.first { Text("Personal best · \(Display.duration(best.elapsedSeconds ?? 0))").font(.title2.bold()) }
                    else { Text("Set your first time.").font(.title2.bold()) }
                    PrimaryButton(title: "Attempt this segment", symbol: "play.fill") { showWorkout = true }
                }
                Picker("Leaderboard", selection: $global) { Text("This iPhone").tag(false); Text("Global").tag(true) }.pickerStyle(.segmented)
                Picker("Period", selection: $monthly) { Text("All time").tag(false); Text("This month").tag(true) }.pickerStyle(.segmented)
                if global {
                    if communityURL.isEmpty {
                        ContentUnavailableView("Community not connected", systemImage: "network", description: Text("Global rankings need a FitCraft server. Personal timing is available now."))
                    } else {
                        Button(loading ? "Refreshing…" : "Refresh global top 10", systemImage: "arrow.clockwise") { Task { await refresh() } }.disabled(loading)
                        ForEach(remote) { row in
                            Card { HStack { Text("\(row.rank)").foregroundStyle(FC.lime); Text(row.displayName); Spacer(); Text(Display.duration(row.elapsedSeconds)).monospacedDigit(); if row.holdsCrown { Image(systemName: "crown.fill").foregroundStyle(.yellow) } }; Text("Set \(row.achievedAt.formatted(date: .abbreviated, time: .omitted)) · cached \(row.fetchedAt.formatted(date: .omitted, time: .shortened))").font(.caption).foregroundStyle(FC.muted) }
                        }
                        if remote.isEmpty { Text("No cached entries for this period.").foregroundStyle(FC.muted) }
                    }
                } else {
                    Text("Personal attempts · local GPS checks · not globally verified").font(.caption).foregroundStyle(FC.muted)
                    ForEach(Array(local.prefix(10).enumerated()), id: \.element.id) { index, attempt in
                        Card {
                            HStack { Text("\(index + 1)").font(.title2.bold()).foregroundStyle(FC.lime); Text(attempt.athlete?.displayName ?? "You").font(.headline); Spacer(); Text(Display.duration(attempt.elapsedSeconds ?? 0)).font(.title3.monospacedDigit()) }
                            Text("\(attempt.startedAt.formatted(date: .abbreviated, time: .shortened)) · \(Display.duration(attempt.paceSecondsPerKilometer ?? 0)) /km · \((attempt.averageSpeedMetersPerSecond ?? 0) * 3.6, specifier: "%.1f") km/h").font(.caption).foregroundStyle(FC.muted)
                        }
                    }
                    if local.isEmpty { Text("No completed attempts in this period.").foregroundStyle(FC.muted) }
                }
                if let message { Text(message).font(.caption).foregroundStyle(.orange) }
            }.padding(20)
        }.navigationTitle(segment.name).fitCraftScreen()
            .fullScreenCover(isPresented: $showWorkout) { if let profile = profiles.first { OutdoorWorkoutView(profile: profile, activity: segment.activity, route: segment.route, segment: segment) } }
            .alert("Crown update", isPresented: Binding(get: { crownAlert != nil }, set: { if !$0 { crownAlert = nil } })) { Button("Keep chasing") { crownAlert = nil } } message: { Text(crownAlert ?? "") }
    }

    private func refresh() async {
        guard let url = URL(string: communityURL) else { message = "Check the service URL in Settings."; return }
        loading = true
        defer { loading = false }
        let requestedMonthly = monthly
        let period: LeaderboardPeriod = requestedMonthly ? .monthly : .allTime
        let previousOwner = segment.leaderboardEntries.first { $0.period == .allTime && $0.rank == 1 }?.athleteID
        do {
            let rows = try await CommunityAPI(baseURL: url).leaderboard(segmentID: segment.id, monthly: requestedMonthly)
            let existing = segment.leaderboardEntries.filter { $0.period == period }
            for entry in existing where !rows.contains(where: { $0.id == entry.id }) { context.delete(entry) }
            for row in rows {
                if let entry = existing.first(where: { $0.id == row.id }) {
                    entry.rank = row.rank; entry.athleteID = row.athleteID; entry.attemptID = row.attemptID
                    entry.displayName = row.displayName; entry.elapsedSeconds = row.elapsedSeconds; entry.achievedAt = row.achievedAt
                    entry.periodStart = requestedMonthly ? Self.monthStart : nil; entry.fetchedAt = .now
                } else {
                    context.insert(LeaderboardEntry(id: row.id, segment: segment, athleteID: row.athleteID, attemptID: row.attemptID, displayName: row.displayName, elapsedSeconds: row.elapsedSeconds, achievedAt: row.achievedAt, rank: row.rank, period: period, periodStart: requestedMonthly ? Self.monthStart : nil))
                }
            }
            try context.save()
            if !requestedMonthly, let ownID = profiles.first?.id, previousOwner == ownID, let owner = rows.first, owner.athleteID != ownID {
                crownAlert = "Your crown on \(segment.name) was taken by \(owner.displayName)."
            }
            message = "Updated just now."
        } catch { context.rollback(); message = error.localizedDescription }
    }
}
