# FitCraft persistence — Step 1

Target: iOS 17+, Swift 6, SwiftData. Add `FitCraftModels.swift` to an iOS app target and attach the container at the app root with `.modelContainer(try FitCraftPersistence.makeContainer())`. Create and access model contexts on the main actor. Transfer Sendable DTOs across networking actors rather than model instances.

`UserProfile` stores onboarding preferences in metric units. `Route` caches geometry and directions. `Segment` stores course geometry and start/finish gates. `SegmentAttempt` records offline tracking and upload/validation state. `LeaderboardEntry` caches ranked server results; its ID must identify an entry within a segment and period, not just an athlete.

Deleting a profile deletes its attempts. Deleting a route preserves segments. Deleting a segment deletes its attempts and cached rankings. Leaderboard athlete and attempt IDs deliberately remain independent of local profile objects, so remote competitors do not require local profiles. Account deletion and remote leaderboard removal require a separate backend operation.

Validate coordinates, positive distances, budget and macro ranges, chronology, and monthly period boundaries at the input/service boundary. Before accepting an attempt, validate route adherence, GPS accuracy, direction, complete gate crossings, and elapsed time. Loops need an explicit leave-and-return state machine because start and finish may overlap. These models alone do not implement tracking or anti-cheat validation.

Global crowns, ties, monthly ranking, and record-loss notifications require an authenticated authoritative backend. Cached `rank` and `holdsCrown` may be stale offline. Do not award global crowns by sorting only local attempts. HealthKit authorization, entitlements, location permission descriptions, motion access, background tracking, and notification registration belong in the app target and service layer.

The unique attributes target a local SwiftData store; CloudKit synchronization would need a separate schema compatibility review. Geometry arrays suit small cached routes; large GPS histories should move to a dedicated sample store. Do not store raw health data or injury notes in logs.

The app now includes `DailyLog` (workout/meal completion with logged macro snapshots) and `OutdoorSession` (GPS track, activity, dates and Health export reference). The shared schema explicitly disables CloudKit because this version uses a local store.

Validation status: the repository now includes an Xcode project and a SwiftData round-trip/deletion XCTest. This Linux workspace has no Apple SDK or Swift compiler, so native compilation and runtime tests remain pending in Xcode on macOS. See the root README and VALIDATION.md.
