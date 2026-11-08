# FitCraft Runner — iPhone Safari test

Entry point: `/runner/` under the existing FitCraft Pages site. Vite builds the original app and Runner as separate entries. Runner uses `fitcraft.runner.v1` storage; the original `fitcraft.web.v1` profile and history are never edited. Both entries share the asset cache, with separate HTML navigation fallbacks for offline use.

Open Runner in Safari and choose **Try the sample runner**, then **Try a session → Start practice**. The 30-second practice requires no GPS, health permissions, account, download, or Apple Developer membership. Safari Share → Add to Home Screen creates a Runner shortcut.

Implemented test flows:

- Personal race-goal review (3–250 km), recent 5K/10K benchmark, E/M/T/I/R estimates, and a conservative weekly volume template. Ultra finishing times are not predicted from road VDOT. Recovery weeks can keep the actual peak below the proposed peak; this is disclosed in the review. The template does not schedule individual days or advanced sessions.
- 30-minute easy run, Norwegian 4×4, ten Billat 30–30 cycles, 5×1000 m and 6×800 m. Distance repetitions use received GPS distance; their recovery matches the preceding work duration. Timers use a monotonic clock, pause/resume, explicit skip counts, optional speech and best-effort vibration. Practice and stopped-early sessions are labeled in the log.
- A dated “Need easy” self-check switches hard-session starts to an easy run. This is self-reported fatigue, not HRV-derived readiness or medical risk assessment.
- Foreground GPS recording with the existing jump/accuracy filtering, saved raw tracks in IndexedDB, loop requests to the public walking-route service, and local personal segment attempts. Provider availability, surface, safety and exact distance are not guaranteed. Maps begin with a labeled Stockholm preview until a route/location is available.
- Existing ingredient-confirmation kitchen, local photo previews, curated recipes, meal logging, editable example macros and missing-ingredient shopping list, all saved to Runner state.
- Offline cached app/plans and a JSON summary export. The export does not include raw tracks or photos and no restore flow is implemented.

Keep Safari visible during a run. Hiding the app pauses the guide, interrupts GPS continuity and cancels in-progress segment matching. Resume is explicit. A session is durable only after Finish & save succeeds; closing/reloading an unsaved run can lose it. iPhone vibration is not guaranteed. Headphones/speaker audio must be explicitly enabled; silent/background operation is not guaranteed.

This is a web test, not the native SwiftData/MapKit build. HealthKit, Garmin, Body Battery, wearable telemetry, lactate calibration, automatic double-threshold programming, Canova workouts, remote leaderboards/push, AI photo recognition and live retailer offers are not connected. No simulated measurements or crown owners are presented as real.

Validation: six Runner logic tests plus nine mobile Chromium browser flows, alongside the original app's 24 logic tests and 18 browser flows. Browser GPS/routing are fixtures; real iPhone Safari and real outdoor accuracy need device testing.
