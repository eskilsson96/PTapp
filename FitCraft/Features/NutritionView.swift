import SwiftUI
import SwiftData

struct NutritionView: View {
    let profile: UserProfile
    @Environment(\.modelContext) private var context
    @Query private var logs: [DailyLog]
    @AppStorage("shoppingChecked") private var shoppingChecked = ""
    @State private var showShopping = false
    @State private var error: String?
    private var meals: [Meal] { PlanningEngine.meals(restrictions: profile.dietaryRestrictions) }
    private var today: DailyLog? { logs.first { Calendar.current.isDateInToday($0.date) } }
    private var weeklyCost: Double { PlanningEngine.estimatedCost(meals.reduce(0) { $0 + $1.estimatedSEK } * 7, currency: profile.currencyCode) }
    private var budget: Double { NSDecimalNumber(decimal: profile.weeklyFoodBudget).doubleValue }
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                SectionTitle(title: "Good food. More energy.", subtitle: "Simple staples for your week")
                Card {
                    HStack { Metric(value: weeklyCost.formatted(.currency(code: profile.currencyCode)), label: "Weekly estimate"); Metric(value: "\(Int(meals.reduce(0) { $0 + $1.protein }))g", label: "Daily protein") }
                    Text(weeklyCost <= budget ? "Within your weekly budget of \(budget.formatted(.currency(code: profile.currencyCode)))." : "This plan exceeds your budget by \((weeklyCost - budget).formatted(.currency(code: profile.currencyCode))). Try the vegetarian options or compare store prices.").font(.subheadline).foregroundStyle(weeklyCost <= budget ? FC.lime : .orange)
                    Text("Estimates for 3 meals × 7 days. Seasonings, snacks and cooking oil are extra. Portions and macros are approximate; adjust to your goals.").font(.caption).foregroundStyle(FC.muted)
                }
                ForEach(meals) { meal in
                    Card {
                        HStack { Label(meal.category.uppercased(), systemImage: meal.symbol).font(.caption.bold()).foregroundStyle(FC.lime); Spacer(); Text("~\(meal.calories) kcal").font(.caption).foregroundStyle(FC.muted) }
                        Text(meal.title).font(.title3.bold())
                        Text("P \(Int(meal.protein))g   C \(Int(meal.carbs))g   F \(Int(meal.fat))g").font(.subheadline.monospacedDigit()).foregroundStyle(FC.muted)
                        ForEach(meal.ingredients) { item in Text("\(Int(item.quantity)) \(item.unit) \(item.name.lowercased())").font(.subheadline) }
                        Text(meal.id == "breakfast" ? "Combine in a bowl; soak oats overnight if preferred." : meal.id == "lunch" ? "Cook rice and protein fully, steam broccoli, then combine. Season to taste." : "Simmer cooked lentils, beans and tomatoes together for 15 minutes. Season to taste.").font(.caption).foregroundStyle(FC.muted)
                        Button(today?.completedMealIDs.contains(meal.id) == true ? "Logged · tap to undo" : "Log meal", systemImage: today?.completedMealIDs.contains(meal.id) == true ? "checkmark.circle.fill" : "plus.circle") { toggle(meal) }.buttonStyle(.bordered)
                    }
                }
                PrimaryButton(title: "Your weekly shopping list", symbol: "basket.fill") { showShopping = true }
            }.padding(20)
        }.navigationTitle("Fuel").fitCraftScreen()
            .sheet(isPresented: $showShopping) { shopping }
            .alert("Couldn’t save meal", isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) { Button("OK") { error = nil } } message: { Text(error ?? "") }
    }
    private var shopping: some View {
        NavigationStack {
            List {
                ForEach(["Produce", "Chilled", "Pantry", "Frozen"], id: \.self) { aisle in
                    Section(aisle) {
                        ForEach(meals.flatMap(\.ingredients).filter { $0.aisle == aisle }) { item in
                            Button {
                                var checked = Set(shoppingChecked.split(separator: "|").map(String.init))
                                if checked.contains(item.id) { checked.remove(item.id) } else { checked.insert(item.id) }
                                shoppingChecked = checked.sorted().joined(separator: "|")
                            } label: {
                                HStack { Image(systemName: shoppingChecked.split(separator: "|").contains(Substring(item.id)) ? "checkmark.circle.fill" : "circle"); Text(item.name).foregroundStyle(.primary); Spacer(); Text("\(Int(item.quantity * 7)) \(item.unit)").foregroundStyle(FC.muted) }
                            }
                        }
                    }
                }
                Button("Reset checkmarks") { shoppingChecked = "" }
            }.navigationTitle("Shop for the week").toolbar { Button("Done") { showShopping = false } }
        }
    }
    private func toggle(_ meal: Meal) {
        let log = today ?? DailyLog()
        if today == nil { context.insert(log) }
        let remove = log.completedMealIDs.contains(meal.id)
        let snapshot = log.mealSnapshots.first { $0.mealID == meal.id } ?? MealSnapshot(mealID: meal.id, protein: meal.protein, carbs: meal.carbs, fat: meal.fat)
        if remove {
            log.completedMealIDs.removeAll { $0 == meal.id }
            log.mealSnapshots.removeAll { $0.mealID == meal.id }
        } else {
            log.completedMealIDs.append(meal.id)
            log.mealSnapshots.append(snapshot)
        }
        let sign = remove ? -1.0 : 1.0
        log.protein = max(0, log.protein + sign * snapshot.protein)
        log.carbs = max(0, log.carbs + sign * snapshot.carbs)
        log.fat = max(0, log.fat + sign * snapshot.fat)
        do { try context.save() } catch { context.rollback(); self.error = error.localizedDescription }
    }
}
