# FitCraft — native iPhone test app

**Safari version:** a mobile web implementation is now available in [`web/`](web/README.md), including offline plans, workouts, meals, maps and visible-browser GPS tracking. Its build/test/hosting instructions are separate from the native app instructions below.

An iOS 17+ SwiftUI application in Swift 6. Open **FitCraft.xcodeproj** in **Xcode 16 or later**. No third-party iOS packages or project generators are required.

## Try it in Simulator

1. Open the project and select the **FitCraft** scheme.
2. Select an iPhone simulator with iOS 17 or later.
3. Press **Run** (⌘R), then complete onboarding.
4. In Simulator, use **Features → Location → Custom Location** to supply GPS coordinates. Map discovery and loop generation require internet access. Simulated movement is necessary to test distance/segments.
5. Use **Product → Test** (⌘U), or run `bash scripts/test-ios.sh`, for unit tests and the onboarding/tab UI smoke test. The UI test saves screenshots in its `.xcresult` bundle.

The app opens on onboarding, not fabricated activity. Complete a workout or log a meal to populate the dashboard. Real route geometry is requested from MapKit. There are no fake global opponents, live discounts, or heart-rate readings.

## Install on your iPhone

1. Open **Signing & Capabilities** on the FitCraft target. Choose your Apple development team and replace `com.fitcraft.app` with a unique bundle ID.
2. Enable HealthKit for that App ID; the project includes the entitlement and usage descriptions.
3. Connect your iPhone, enable Developer Mode if prompted, select it as the destination and press Run.

HealthKit capability availability depends on your Apple developer team. For a free personal-team build without HealthKit, remove the HealthKit capability and leave Health integration disconnected; other local features remain available. A signed developer build has Apple's provisioning limits.

## Distribute through TestFlight

An active Apple Developer Program membership is required. In App Store Connect, create the FitCraft app matching your unique bundle ID. Select a generic iOS device destination in Xcode, use **Product → Archive**, then **Distribute App → App Store Connect → Upload**. After Apple processes the build, add internal testers in TestFlight. External testing may require beta review. Enter beta app details and complete Apple's compliance questions. Review privacy declarations for any backend you later connect.

This repository does not include signing certificates, profiles or Apple account credentials. The downloadable source archive is **not an IPA**. The included GitHub Actions workflow produces an **iOS Simulator app** and test results after you push it and the job succeeds. Simulator artifacts do not run on a physical iPhone. No TestFlight upload has been performed.

## Implemented test-app flows

- Native three-step onboarding: goals, age, optional sex, gym/equipment, level, injury notes, currency/budget, diet and macro goals.
- Dark forest/lime visual design, native tabs, SF Symbols, Dynamic Type layouts, VoiceOver labels, haptic completion cues, app icon and launch colors.
- Dashboard with real logged macro totals, workout status, activity history and Swift Charts weekly distance.
- Equipment-aware full-body suggestions, rep progression guidance, exercise checklists and a rest timer. This is a general template, not injury rehabilitation or adaptive coaching.
- Three daily staple meals, vegetarian/vegan/dairy-free options, gluten-free ingredient choices, estimated weekly budget and a persistent aisle shopping checklist. Repeated seven-day shopping quantities are shown; prices and conversions are illustrative rather than live quotes.
- MapKit nearby search, approximate loop generation using walking directions, directions preview, persisted geometry, segment creation and map overlays. Generated loops can overlap and do not guarantee scenic or cycling-safe paths.
- Foreground/background location recording for user-started activities, pedometer step counting, elapsed pace/distance and recorded elevation chart. No pause control; elapsed time continues throughout the workout.
- Start/finish segment gates, ordered course checkpoints, accuracy filtering, implausible jump filtering, audio/haptic cues, personal top-ten attempts and monthly filtering. Local attempts remain pending server validation.
- Optional recent HealthKit heart-rate reads and explicit completed-workout export of time/distance. GPS tracks remain local; no Watch app or continuous live Watch sensor stream is included.
- Optional read-only HTTPS API adapters for grocery offers and global top ten. Connected all-time crown changes show an in-app alert on refresh.

## External services still required

There is no deployed backend, user authentication, shared segment registry, validated attempt submission, push notification service, or supermarket agreement/scraper. Global competition needs all of these plus server-side course/anti-cheat validation. The test app works locally without them; global rankings and offers display their unconnected state. See [API-CONTRACT.md](API-CONTRACT.md) for the optional read API.

## Architecture

`App/` contains the app entry point and observable tab/sheet coordinator. `Features/` contains SwiftUI screens. `Services/` contains observable location, map, HealthKit and recording state plus async networking. `Core/` holds deterministic planning and geometry logic. `Models/` holds SwiftData models and the local container. Apple framework services and models are main-actor owned; API response DTOs are Sendable.

SwiftData stores routes, profiles, attempts, cached rankings, daily logs and outdoor sessions. UserDefaults holds shopping checkmarks and the optional public service URL. Do not put credentials into that URL. Live processes are not persisted. Force-quitting during a workout stops tracking and can lose that unfinished session.

## Validation status

The implementation was created in a Linux environment without Xcode or Apple SDKs. Native compilation, simulator tests and physical-device checks **have not run here**. Static parsing and project/resource checks are reported separately in `VALIDATION.md`. The repository includes seven unit tests and one UI test for the first macOS build. Do not treat the presence of a CI workflow as evidence of a passing build.

Before beta distribution, run the tests, check GPS outdoors (including a loop and a reversed course), validate Health permissions denied/granted, background/lock-screen tracking, VoiceOver and large text, and verify offline relaunch. Use `scripts/generate_project.py` only when adding/removing source files; it regenerates project settings, so preserve custom signing configuration first.
