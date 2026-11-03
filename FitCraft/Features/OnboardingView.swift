import SwiftUI
import SwiftData

struct OnboardingView: View {
    @Environment(\.modelContext) private var context
    @State private var page = 0
    @State private var name = ""
    @State private var age = 25
    @State private var sex: ProfileSex = .unspecified
    @State private var weight = 75.0
    @State private var target = 75.0
    @State private var targetDate = Calendar.current.date(byAdding: .month, value: 3, to: .now) ?? .now
    @State private var gym = false
    @State private var equipment: Set<Equipment> = []
    @State private var level: FitnessLevel = .beginner
    @State private var injuries = ""
    @State private var budget = 700.0
    @State private var currency = "SEK"
    @State private var restrictions: Set<String> = []
    @State private var protein = 120.0
    @State private var carbs = 250.0
    @State private var fat = 70.0
    @State private var error: String?

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                HStack {
                    Label("FITCRAFT", systemImage: "figure.strengthtraining.traditional").font(.headline).tracking(2)
                    Spacer()
                    Text("\(page + 1) / 3").foregroundStyle(FC.muted)
                }.padding(24)
                ProgressView(value: Double(page + 1), total: 3).padding(.horizontal, 24)
                Form {
                    if page == 0 {
                        Section {
                            Text("Your next chapter\nstarts here.").font(.largeTitle.bold())
                            Text("A plan that fits your life. A little stronger, every day.").foregroundStyle(FC.muted)
                        }.listRowBackground(Color.clear)
                        Section("About you") {
                            TextField("Your name", text: $name).textContentType(.givenName).accessibilityIdentifier("profileName")
                            Stepper("Age: \(age)", value: $age, in: 18...100)
                            Picker("Sex (optional)", selection: $sex) { ForEach(ProfileSex.allCases, id: \.self) { Text($0.rawValue.capitalized).tag($0) } }
                            LabeledContent("Current weight · kg") { TextField("kg", value: $weight, format: .number).keyboardType(.decimalPad).multilineTextAlignment(.trailing) }
                            LabeledContent("Target weight · kg") { TextField("kg", value: $target, format: .number).keyboardType(.decimalPad).multilineTextAlignment(.trailing) }
                            DatePicker("Target date", selection: $targetDate, in: Date.now..., displayedComponents: .date)
                        }
                        Section { Text("For adults 18+. Your target is a personal goal; FitCraft does not prescribe a weight-loss rate.").font(.footnote).foregroundStyle(FC.muted) }
                    } else if page == 1 {
                        Section("Make room for movement") {
                            Toggle("I have a gym membership", isOn: $gym)
                            Picker("Experience", selection: $level) { ForEach(FitnessLevel.allCases, id: \.self) { Text($0.rawValue.capitalized).tag($0) } }
                        }
                        Section("Home equipment") {
                            LazyVGrid(columns: [GridItem(.adaptive(minimum: 125))], spacing: 12) {
                                ForEach(Equipment.allCases, id: \.self) { item in
                                    Button {
                                        if equipment.contains(item) { equipment.remove(item) } else { equipment.insert(item) }
                                    } label: {
                                        Label(equipmentName(item), systemImage: equipment.contains(item) ? "checkmark.circle.fill" : "circle")
                                            .font(.subheadline).frame(maxWidth: .infinity, minHeight: 48)
                                    }.buttonStyle(.bordered).accessibilityAddTraits(equipment.contains(item) ? .isSelected : [])
                                }
                            }
                        }
                        Section("Anything to keep in mind?") {
                            TextField("Injury or movement notes", text: $injuries, axis: .vertical).lineLimit(3...5)
                            Text("Notes are saved for your reference. Plans are not injury rehabilitation; skip painful movements and seek individual guidance.").font(.footnote).foregroundStyle(FC.muted)
                        }
                    } else {
                        Section("Fuel your progress") {
                            Picker("Currency", selection: $currency) { ForEach(["SEK", "EUR", "USD"], id: \.self) { Text($0).tag($0) } }
                                .onChange(of: currency) { old, new in budget = budget / (old == "SEK" ? 10 : 1) * (new == "SEK" ? 10 : 1) }
                            Text("Weekly budget: \(budget, format: .currency(code: currency))")
                            Slider(value: $budget, in: currency == "SEK" ? 200...2000 : 20...200, step: currency == "SEK" ? 10 : 1)
                            ForEach(["Vegetarian", "Vegan", "Dairy-free", "Gluten-free"], id: \.self) { item in
                                Toggle(item, isOn: Binding(get: { restrictions.contains(item) }, set: { if $0 { restrictions.insert(item) } else { restrictions.remove(item) } }))
                            }
                        }
                        Section("Daily macro targets · editable goals") {
                            Stepper("Protein: \(Int(protein)) g", value: $protein, in: 30...250, step: 5)
                            Stepper("Carbs: \(Int(carbs)) g", value: $carbs, in: 50...500, step: 10)
                            Stepper("Fat: \(Int(fat)) g", value: $fat, in: 20...150, step: 5)
                            Text("Starting values are examples, not a medical recommendation. Check ingredient labels for allergens.").font(.footnote).foregroundStyle(FC.muted)
                        }
                    }
                }.scrollContentBackground(.hidden)
                HStack {
                    if page > 0 { Button("Back") { page -= 1 }.padding() }
                    PrimaryButton(title: page == 2 ? "Let’s build your day" : "Continue") {
                        if page < 2 { page += 1 } else { save() }
                    }.accessibilityIdentifier("onboardingContinue")
                }.padding(24)
            }
            .fitCraftScreen()
            .sensoryFeedback(.selection, trigger: page)
            .alert("Check your profile", isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) { Button("OK") { error = nil } } message: { Text(error ?? "") }
        }
    }

    private func save() {
        guard !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, weight.isFinite, target.isFinite, (30...350).contains(weight), (30...350).contains(target) else {
            error = "Enter your name and weights between 30 and 350 kg."
            page = 0
            return
        }
        let profile = UserProfile(displayName: name.trimmingCharacters(in: .whitespacesAndNewlines), currencyCode: currency)
        profile.birthDate = Calendar.current.date(byAdding: .year, value: -age, to: .now)
        profile.sex = sex
        profile.currentWeightKg = weight
        profile.targetWeightKg = target
        profile.targetDate = targetDate
        profile.hasGymMembership = gym
        profile.equipment = Array(equipment)
        profile.fitnessLevel = level
        profile.injuryNotes = injuries
        profile.weeklyFoodBudget = Decimal(budget)
        profile.dietaryRestrictions = Array(restrictions)
        profile.dailyProteinGrams = protein
        profile.dailyCarbohydrateGrams = carbs
        profile.dailyFatGrams = fat
        context.insert(profile)
        do { try context.save() } catch { context.rollback(); self.error = error.localizedDescription }
    }
}

func equipmentName(_ equipment: Equipment) -> String {
    switch equipment {
    case .resistanceBands: "Bands"
    case .pullUpBar: "Pull-up bar"
    default: equipment.rawValue.capitalized
    }
}
