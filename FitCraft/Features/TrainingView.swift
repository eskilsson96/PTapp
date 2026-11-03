import SwiftUI
import SwiftData

struct TrainingView: View {
    let profile: UserProfile
    @Environment(\.modelContext) private var context
    @Query(sort: \DailyLog.date, order: .reverse) private var logs: [DailyLog]
    @State private var completed: Set<String> = []
    @State private var error: String?
    @State private var restUntil: Date?
    private var today: DailyLog? { logs.first { Calendar.current.isDateInToday($0.date) } }
    private var exercises: [Exercise] { PlanningEngine.workout(gym: profile.hasGymMembership, equipment: profile.equipment, level: profile.fitnessLevel, completedSessions: logs.filter(\.workoutCompleted).count) }
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                SectionTitle(title: "Build a stronger base.", subtitle: "Full body · 35–45 min · \(profile.fitnessLevel.rawValue.capitalized)")
                Card {
                    Label(profile.hasGymMembership ? "Gym session" : "Your home session", systemImage: "dumbbell.fill").font(.headline).foregroundStyle(FC.lime)
                    Text("Aim for 2–3 sessions each week, with a rest day between strength sessions. Complete every set before checking off an exercise.").foregroundStyle(FC.muted)
                    ProgressView(value: today?.workoutCompleted == true ? 1 : Double(completed.count) / Double(exercises.count))
                }
                if !profile.injuryNotes.isEmpty {
                    Card { Label("Your movement notes", systemImage: "heart.text.clipboard").font(.headline); Text(profile.injuryNotes); Text("This general plan has not been adapted to your injury. Get guidance on substitutions before training.").font(.caption).foregroundStyle(FC.muted) }
                }
                ForEach(exercises) { exercise in
                    Card {
                        HStack(alignment: .top) {
                            VStack(alignment: .leading, spacing: 7) {
                                Text(exercise.name).font(.headline)
                                Text("\(exercise.sets) sets × \(exercise.repetitions)").foregroundStyle(FC.lime)
                            }
                            Spacer()
                            Button {
                                if completed.contains(exercise.id) { completed.remove(exercise.id) } else { completed.insert(exercise.id) }
                            } label: { Image(systemName: completed.contains(exercise.id) || today?.workoutCompleted == true ? "checkmark.circle.fill" : "circle").font(.title) }.accessibilityLabel("Mark \(exercise.name) completed")
                                .disabled(today?.workoutCompleted == true)
                        }
                        Text(exercise.note).font(.subheadline).foregroundStyle(FC.muted)
                    }
                }
                if let restUntil {
                    TimelineView(.periodic(from: .now, by: 1)) { timeline in
                        Text(timeline.date >= restUntil ? "Rest complete. Ready when you are." : "Rest · \(Display.duration(restUntil.timeIntervalSince(timeline.date)))").font(.title3.monospacedDigit()).foregroundStyle(FC.lime)
                    }
                }
                Button("Start 60-second rest", systemImage: "timer") { restUntil = .now.addingTimeInterval(60) }.buttonStyle(.bordered)
                PrimaryButton(title: today?.workoutCompleted == true ? "Workout completed" : "Finish workout", symbol: "checkmark") { finish() }
                    .disabled(today?.workoutCompleted == true || completed.count != exercises.count)
                    .opacity(today?.workoutCompleted == true || completed.count != exercises.count ? 0.5 : 1)
            }.padding(20)
        }.navigationTitle("Train").fitCraftScreen().sensoryFeedback(.success, trigger: completed.count)
            .alert("Couldn’t save workout", isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) { Button("OK") { error = nil } } message: { Text(error ?? "") }
    }
    private func finish() {
        let log = today ?? DailyLog()
        if today == nil { context.insert(log) }
        log.workoutCompleted = true
        do { try context.save() } catch { context.rollback(); self.error = error.localizedDescription }
    }
}
