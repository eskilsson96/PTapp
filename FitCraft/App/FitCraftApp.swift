import SwiftUI
import SwiftData
import Observation

@MainActor @Observable
final class AppCoordinator {
    enum Tab: Hashable { case today, train, fuel, explore, records }
    var tab: Tab = .today
    var showSettings = false
}

@main
struct FitCraftApp: App {
    private let container: ModelContainer?
    private let storageError: String?
    @State private var coordinator = AppCoordinator()
    @State private var location = LocationService()
    @State private var health = HealthService()

    init() {
        do {
            container = try FitCraftPersistence.makeContainer(inMemory: ProcessInfo.processInfo.arguments.contains("--uitesting"))
            storageError = nil
        } catch {
            container = nil
            storageError = error.localizedDescription
        }
    }

    var body: some Scene {
        WindowGroup {
            Group {
                if let container {
                    AppRoot()
                        .modelContainer(container)
                        .environment(coordinator)
                        .environment(location)
                        .environment(health)
                } else {
                    ContentUnavailableView("Couldn’t open your data", systemImage: "externaldrive.badge.exclamationmark", description: Text(storageError ?? "Restart FitCraft to try again. Your data has not been erased."))
                }
            }
            .preferredColorScheme(.dark)
            .tint(FC.lime)
        }
    }
}

struct AppRoot: View {
    @Query private var profiles: [UserProfile]
    @Environment(AppCoordinator.self) private var coordinator
    var body: some View {
        @Bindable var coordinator = coordinator
        if let profile = profiles.first {
            TabView(selection: $coordinator.tab) {
                NavigationStack { DashboardView(profile: profile) }.tabItem { Label("Today", systemImage: "square.grid.2x2.fill") }.tag(AppCoordinator.Tab.today)
                NavigationStack { TrainingView(profile: profile) }.tabItem { Label("Train", systemImage: "dumbbell.fill") }.tag(AppCoordinator.Tab.train)
                NavigationStack { NutritionView(profile: profile) }.tabItem { Label("Fuel", systemImage: "leaf.fill") }.tag(AppCoordinator.Tab.fuel)
                NavigationStack { ExploreView(profile: profile) }.tabItem { Label("Explore", systemImage: "map.fill") }.tag(AppCoordinator.Tab.explore)
                NavigationStack { RecordsView() }.tabItem { Label("Records", systemImage: "crown.fill") }.tag(AppCoordinator.Tab.records)
            }
            .sheet(isPresented: $coordinator.showSettings) { NavigationStack { SettingsView(profile: profile) } }
        } else {
            OnboardingView()
        }
    }
}
