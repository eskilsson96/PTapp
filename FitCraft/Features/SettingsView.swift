import SwiftUI
import SwiftData

struct SettingsView: View {
    let profile: UserProfile
    @State private var draft: ProfileSettings
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @Environment(HealthService.self) private var health
    @AppStorage("communityURL") private var communityURL = ""
    @State private var offers: [GroceryOffer] = []
    @State private var message: String?
    @State private var loading = false
    init(profile: UserProfile) {
        self.profile = profile
        _draft = State(initialValue: ProfileSettings(profile: profile))
    }

    var body: some View {
        Form {
            Section("Your profile") {
                TextField("Name", text: $draft.displayName)
                Toggle("Gym membership", isOn: $draft.hasGymMembership)
                ForEach(Equipment.allCases, id: \.self) { item in
                    Toggle(equipmentName(item), isOn: Binding(get: { draft.equipment.contains(item) }, set: { enabled in
                        if enabled { if !draft.equipment.contains(item) { draft.equipment.append(item) } }
                        else { draft.equipment.removeAll { $0 == item } }
                    }))
                }
                Picker("Level", selection: $draft.fitnessLevel) { ForEach(FitnessLevel.allCases, id: \.self) { Text($0.rawValue.capitalized).tag($0) } }
                TextField("Movement notes", text: $draft.injuryNotes, axis: .vertical)
            }
            Section("Budget") {
                Text("Currency: \(draft.currencyCode)")
                TextField("Weekly budget", value: $draft.weeklyFoodBudget, format: .number).keyboardType(.decimalPad)
            }
            Section("Macro goals") {
                Stepper("Protein: \(Int(draft.dailyProteinGrams)) g", value: $draft.dailyProteinGrams, in: 30...250, step: 5)
                Stepper("Carbs: \(Int(draft.dailyCarbohydrateGrams)) g", value: $draft.dailyCarbohydrateGrams, in: 50...500, step: 10)
                Stepper("Fat: \(Int(draft.dailyFatGrams)) g", value: $draft.dailyFatGrams, in: 20...150, step: 5)
            }
            Section("Dietary preferences") {
                ForEach(["Vegetarian", "Vegan", "Dairy-free", "Gluten-free"], id: \.self) { item in
                    Toggle(item, isOn: Binding(get: { draft.dietaryRestrictions.contains(item) }, set: { enabled in if enabled { if !draft.dietaryRestrictions.contains(item) { draft.dietaryRestrictions.append(item) } } else { draft.dietaryRestrictions.removeAll { $0 == item } } }))
                }
            }
            Section("Apple Health") {
                Button(health.connected ? "Review Health permissions" : "Connect Apple Health", systemImage: "heart.fill") { Task { await health.authorize() } }
                Text(health.message ?? "Optional. Read recent heart rate and choose which completed workouts to save to Health.").font(.caption)
            }
            Section("Community & grocery service") {
                TextField("https://your-service.example", text: $communityURL).textInputAutocapitalization(.never).autocorrectionDisabled().keyboardType(.URL)
                Text("Optional public API. The test app works without it. No accounts, record uploads or push server are connected.").font(.caption)
                Button(loading ? "Loading offers…" : "Load grocery offers") {
                    guard let url = URL(string: communityURL) else { message = "Enter the HTTPS URL for your service."; return }
                    loading = true
                    Task { defer { loading = false }; do { offers = try await CommunityAPI(baseURL: url).offers(); message = offers.isEmpty ? "No current offers." : nil } catch { message = error.localizedDescription } }
                }.disabled(loading || communityURL.isEmpty)
                ForEach(offers) { offer in VStack(alignment: .leading) { Text(offer.title).font(.headline); Text("\(offer.store) · \(offer.price.formatted(.currency(code: offer.currency)))"); Text("Until \(offer.validUntil.formatted(date: .abbreviated, time: .omitted))").font(.caption) } }
            }
            Section("About this test app") {
                Text("FitCraft 0.1 · Personal training, simple food, fresh air.")
                Text("Your profile, notes, sessions and routes stay in this app’s local store. Map searches use Apple services. Health export and the optional community service require your action. Removing the app removes local data.").font(.caption)
                Text("Meal costs are illustrative estimates. Global rankings and live discounts require a compatible external service. This iPhone app does not stream live Apple Watch heart rate.").font(.caption)
            }
            if let message { Text(message).foregroundStyle(.orange) }
        }.navigationTitle("Your FitCraft").toolbar { Button("Save") {
            guard !draft.displayName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, draft.weeklyFoodBudget > 0 else { message = "Enter a name and a positive weekly budget."; return }
            draft.apply(to: profile)
            do { try context.save(); dismiss() } catch { context.rollback(); message = error.localizedDescription }
        } }
    }
}


private struct ProfileSettings {
    var displayName: String
    var hasGymMembership: Bool
    var equipment: [Equipment]
    var fitnessLevel: FitnessLevel
    var injuryNotes: String
    var currencyCode: String
    var weeklyFoodBudget: Decimal
    var dailyProteinGrams: Double
    var dailyCarbohydrateGrams: Double
    var dailyFatGrams: Double
    var dietaryRestrictions: [String]

    init(profile: UserProfile) {
        displayName = profile.displayName
        hasGymMembership = profile.hasGymMembership
        equipment = profile.equipment
        fitnessLevel = profile.fitnessLevel
        injuryNotes = profile.injuryNotes
        currencyCode = profile.currencyCode
        weeklyFoodBudget = profile.weeklyFoodBudget
        dailyProteinGrams = profile.dailyProteinGrams
        dailyCarbohydrateGrams = profile.dailyCarbohydrateGrams
        dailyFatGrams = profile.dailyFatGrams
        dietaryRestrictions = profile.dietaryRestrictions
    }

    func apply(to profile: UserProfile) {
        profile.displayName = displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        profile.hasGymMembership = hasGymMembership
        profile.equipment = equipment
        profile.fitnessLevel = fitnessLevel
        profile.injuryNotes = injuryNotes
        profile.weeklyFoodBudget = weeklyFoodBudget
        profile.dailyProteinGrams = dailyProteinGrams
        profile.dailyCarbohydrateGrams = dailyCarbohydrateGrams
        profile.dailyFatGrams = dailyFatGrams
        profile.dietaryRestrictions = dietaryRestrictions
    }
}
