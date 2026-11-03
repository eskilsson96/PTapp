import SwiftUI
import SwiftData
import Charts

struct DashboardView: View {
    let profile: UserProfile
    @Environment(AppCoordinator.self) private var coordinator
    @Query(sort: \DailyLog.date, order: .reverse) private var logs: [DailyLog]
    @Query(sort: \OutdoorSession.startedAt, order: .reverse) private var sessions: [OutdoorSession]
    @Query private var segments: [Segment]
    private var today: DailyLog? { logs.first { Calendar.current.isDateInToday($0.date) } }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HStack {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(Date.now.formatted(.dateTime.weekday(.wide).month().day()).uppercased()).font(.caption.bold()).tracking(1.5).foregroundStyle(FC.muted)
                        Text("Let’s go, \(profile.displayName).").font(.largeTitle.bold())
                    }
                    Spacer()
                    Button { coordinator.showSettings = true } label: { Image(systemName: "person.crop.circle").font(.largeTitle).foregroundStyle(FC.lime) }.accessibilityLabel("Profile and settings")
                }
                VStack(alignment: .leading, spacing: 20) {
                    Label("BUILT AROUND YOU", systemImage: "sparkles").font(.caption.bold()).tracking(1)
                    Text("Small steps.\nStronger you.").font(.system(.largeTitle, design: .rounded, weight: .heavy))
                    Text(today?.workoutCompleted == true ? "Today’s workout is in the books. Make time to recover." : "Your next full-body session is ready. Show up at your own pace.").font(.subheadline)
                    Button { coordinator.tab = .train } label: { Label(today?.workoutCompleted == true ? "View your plan" : "See today’s workout", systemImage: "arrow.up.right").font(.headline).padding(14).background(.black.opacity(0.12), in: Capsule()) }
                }
                .foregroundStyle(.black).frame(maxWidth: .infinity, alignment: .leading).padding(24)
                .background(LinearGradient(colors: [FC.lime, Color(red: 0.47, green: 0.79, blue: 0.35)], startPoint: .topLeading, endPoint: .bottomTrailing), in: RoundedRectangle(cornerRadius: 28))

                SectionTitle(title: "Your daily fuel", subtitle: "Remaining against your personal targets")
                Card {
                    HStack {
                        MacroRing(label: "Protein", consumed: today?.protein ?? 0, target: profile.dailyProteinGrams, color: FC.lime)
                        MacroRing(label: "Carbs", consumed: today?.carbs ?? 0, target: profile.dailyCarbohydrateGrams, color: .orange)
                        MacroRing(label: "Fat", consumed: today?.fat ?? 0, target: profile.dailyFatGrams, color: .cyan)
                    }
                    Button("Open meal plan") { coordinator.tab = .fuel }.font(.subheadline.bold())
                }
                SectionTitle(title: "Find your outside", subtitle: "A new route. A fresh perspective.")
                Card {
                    Label("Your next adventure", systemImage: "map.fill").font(.headline).foregroundStyle(FC.lime)
                    Text(segments.isEmpty ? "Build a loop nearby and turn your favorite stretch into a personal challenge." : "You have \(segments.count) saved segments ready to explore.").foregroundStyle(FC.muted)
                    Button("Explore nearby →") { coordinator.tab = .explore }.font(.headline)
                }
                SectionTitle(title: "This week", subtitle: "Every session counts")
                Card {
                    HStack {
                        Metric(value: "\(logs.filter { $0.workoutCompleted && $0.date >= weekStart }.count)", label: "Workouts")
                        Metric(value: String(format: "%.1f", sessions.filter { $0.startedAt >= weekStart }.reduce(0) { $0 + $1.distanceMeters } / 1000), label: "Outdoor km")
                    }
                    Chart(0..<7, id: \.self) { offset in
                        let date = Calendar.current.date(byAdding: .day, value: offset, to: weekStart) ?? .now
                        let distance = sessions.filter { Calendar.current.isDate($0.startedAt, inSameDayAs: date) }.reduce(0) { $0 + $1.distanceMeters } / 1000
                        BarMark(x: .value("Day", date, unit: .day), y: .value("Kilometers", distance)).foregroundStyle(FC.lime).cornerRadius(5)
                    }.frame(height: 120).chartYAxisLabel("km")
                }
                Card {
                    Label("Smart fuel, smaller spend", systemImage: "basket.fill").font(.headline)
                    Text("Frozen vegetables, lentils and seasonal produce stretch your budget. Compare unit prices when you shop.").foregroundStyle(FC.muted)
                    Text("Planning tip · store offers available when connected in Settings").font(.caption).foregroundStyle(FC.muted)
                }
            }.padding(20)
        }.fitCraftScreen().navigationBarHidden(true)
    }
    private var weekStart: Date { Calendar.current.dateInterval(of: .weekOfYear, for: .now)?.start ?? .now }
}

struct MacroRing: View {
    let label: String
    let consumed: Double
    let target: Double
    let color: Color
    var body: some View {
        VStack(spacing: 10) {
            ZStack {
                Circle().stroke(color.opacity(0.15), lineWidth: 7)
                Circle().trim(from: 0, to: target > 0 ? min(1, max(0, consumed / target)) : 0).stroke(color, style: StrokeStyle(lineWidth: 7, lineCap: .round)).rotationEffect(.degrees(-90))
                Text("\(Int(max(0, target - consumed)))g").font(.headline).minimumScaleFactor(0.6)
            }.frame(width: 78, height: 78)
            Text(label).font(.caption).foregroundStyle(FC.muted)
        }.frame(maxWidth: .infinity).accessibilityElement(children: .ignore).accessibilityLabel("\(label): \(Int(max(0, target - consumed))) grams remaining")
    }
}
