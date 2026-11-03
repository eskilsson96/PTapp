import Foundation

struct Exercise: Identifiable, Sendable {
    var id: String { name }
    let name: String
    let sets: Int
    let repetitions: String
    let note: String
}

enum PlanningEngine {
    static func workout(gym: Bool, equipment: [Equipment], level: FitnessLevel, completedSessions: Int) -> [Exercise] {
        let sets = level == .beginner ? 2 : (level == .advanced ? 4 : 3)
        let weighted = gym || equipment.contains(.dumbbells) || equipment.contains(.kettlebell)
        let lower = gym ? "Goblet squat" : (equipment.contains(.dumbbells) ? "Dumbbell squat" : (equipment.contains(.kettlebell) ? "Kettlebell goblet squat" : "Bodyweight squat"))
        let pull = gym ? "Seated cable row" : (weighted ? "Single-arm row" : (equipment.contains(.resistanceBands) ? "Band row" : "Prone Y raises"))
        let progression = completedSessions >= 3 ? "If every set feels controlled, add 1–2 reps. Increase load only when the top rep range feels comfortable." : "Choose a comfortable effort with 2–3 reps in reserve."
        return [
            Exercise(name: "Warm up", sets: 1, repetitions: "5 min", note: "Easy movement and gentle joint circles."),
            Exercise(name: lower, sets: sets, repetitions: "8–12", note: progression),
            Exercise(name: gym ? "Chest press" : "Incline push-up", sets: sets, repetitions: "8–12", note: progression),
            Exercise(name: pull, sets: sets, repetitions: "10–15", note: progression),
            Exercise(name: weighted ? "Romanian deadlift" : "Glute bridge", sets: sets, repetitions: "10–12", note: "Move slowly through a comfortable range."),
            Exercise(name: "Dead bug", sets: 2, repetitions: "8 each side", note: "Breathe steadily; keep your back comfortable.")
        ]
    }

    static func meals(restrictions: [String]) -> [Meal] {
        let vegan = restrictions.contains("Vegan")
        let vegetarian = vegan || restrictions.contains("Vegetarian")
        let dairyFree = vegan || restrictions.contains("Dairy-free")
        let breakfast = Meal(id: "breakfast", title: dairyFree ? "Soy yogurt oat bowl" : "Skyr & berry oats", category: "Breakfast", symbol: "sunrise.fill", protein: dairyFree ? 26 : 38, carbs: 63, fat: 14, estimatedSEK: 23, ingredients: [Ingredient(name: dairyFree ? "Soy yogurt" : "Skyr", aisle: "Chilled", quantity: 250, unit: "g"), Ingredient(name: "Certified gluten-free oats", aisle: "Pantry", quantity: 70, unit: "g"), Ingredient(name: "Frozen berries", aisle: "Frozen", quantity: 100, unit: "g")])
        let lunch = Meal(id: "lunch", title: vegetarian ? "Tofu rice power bowl" : "Chicken rice power bowl", category: "Lunch", symbol: "sun.max.fill", protein: vegetarian ? 38 : 47, carbs: 80, fat: 18, estimatedSEK: vegetarian ? 28 : 32, ingredients: [Ingredient(name: vegetarian ? "Firm tofu" : "Chicken breast", aisle: "Chilled", quantity: 200, unit: "g"), Ingredient(name: "Rice (dry)", aisle: "Pantry", quantity: 90, unit: "g"), Ingredient(name: "Broccoli", aisle: "Produce", quantity: 150, unit: "g")])
        let dinner = Meal(id: "dinner", title: "Smoky lentil & bean chili", category: "Dinner", symbol: "moon.stars.fill", protein: 32, carbs: 74, fat: 12, estimatedSEK: 24, ingredients: [Ingredient(name: "Cooked lentils", aisle: "Pantry", quantity: 200, unit: "g"), Ingredient(name: "Kidney beans", aisle: "Pantry", quantity: 150, unit: "g"), Ingredient(name: "Crushed tomatoes", aisle: "Pantry", quantity: 200, unit: "g")])
        return [breakfast, lunch, dinner]
    }

    /// Illustrative planning conversion, not a live exchange rate or store quote.
    static func estimatedCost(_ sek: Double, currency: String) -> Double {
        switch currency { case "EUR": sek / 11; case "USD": sek / 10; default: sek }
    }
}

struct Ingredient: Identifiable, Sendable {
    var id: String { name }
    let name: String
    let aisle: String
    let quantity: Double
    let unit: String
}

struct Meal: Identifiable, Sendable {
    let id: String
    let title: String
    let category: String
    let symbol: String
    let protein: Double
    let carbs: Double
    let fat: Double
    let estimatedSEK: Double
    let ingredients: [Ingredient]
    var calories: Int { Int(protein * 4 + carbs * 4 + fat * 9) }
}
