# FitCraft for Safari

A mobile web app with a Home Screen manifest and offline app shell. Designed for Safari on iOS 16+, with no Apple Developer account required to use it. This is a separate web implementation; the Swift project remains in `../FitCraft`.

## Local development

Use Node 22+:

```sh
cd web
npm ci
npm run dev
```

For a production build, run `npm run build`. Publish the **contents of `web/dist`** to a static HTTPS host. Relative asset paths support a repository subdirectory. Opening source files from the Files app does not install the PWA. Geolocation and service workers require HTTPS except on a developer's localhost.

## What the test app does

- Three-step profile setup, optional clearly labeled demo profile, and editable training/nutrition preferences.
- Personalized equipment-aware strength templates, progression guidance, exercise completion, a rest timer, and daily history.
- Three staple meals, diet substitutions, saved nutrition logs, macro progress and weekly aisle shopping checkmarks. Undo uses the original meal snapshot even when dietary preferences change.
- Leaflet/OpenStreetMap map, current location, approximate walking/running or cycling loop generation, directions preview, route cache and nearby park/track/gym search.
- Segment creation from saved route geometry and local personal top-ten times, with monthly filtering.
- Visible-browser GPS recording, ordered segment checkpoints, signal/jump filtering, segment speech cues, workout journal and local GPS tracks.
- LocalStorage for profile/plans/summaries, IndexedDB for tracks, JSON data export, offline app resources and Home Screen instructions.

Workout templates are general suggestions, not injury rehabilitation. Meal costs and macros are estimates; live store discounts are not included. No login, shared global leaderboard, remote notifications or backend is connected. Personal segment attempts are not competition-verified.

## Today, endurance coaching and smart kitchen update

Today now shows a one-tap workout entry, remaining macros, meal choices, and quick actions for the kitchen, routes and endurance goals.

Open **Today → Set an endurance goal** or **Train → Set a race goal** for running/cycling goals, standard race presets or a custom 5–200 km distance. Goal setup accepts 6–24 requested weeks, reviews the timeline and saves an 8–24-week recommendation. The 200 km limit is for goal entry, not a change to map route generation. Running estimates use benchmark VDOT and Riegel; cycling does not reuse those running formulas. Training details are collapsed by default. Warnings explain ambitious pace targets, short timelines and reference volume growth above 10%; these are planning heuristics, not validated individual injury predictions.

An active plan offers a weekly check-in after seven days. Actual completed distance and today's available manual readiness can reduce future volume, extend the timeline up to two weeks, or shorten it one week above the minimum preparation period. Completed weeks and adjustment history are preserved. Duplicate check-ins are blocked; taper weeks cannot be changed. Zero completed distance pauses future load until a new baseline is set. No missed kilometers are made up.

Open **Train → Recovery** to enter measured SDNN HRV and sleep manually. Readiness requires today's entry plus seven distinct earlier days from the same source within 28 days. Do not mix SDNN and Garmin RMSSD. Missing data remains unscored and cannot trigger timeline compression. Safari cannot access HealthKit or sync Apple Watch; Garmin is not connected. A recovery measurement alone does not change a saved plan.

Open **Today → Snap fridge** or **Fuel → Cook from your fridge**. Take or select up to three photos, verify ingredients and amounts, then find recipes from a curated offline library. Every required ingredient must be present in enough grams; only cooking water is assumed. Optional missing spices are shown separately. Recipes have step-by-step preparation, timing, approximate macros, meal logging/undo, and missing-ingredient additions to the aisle shopping list. Results are ranked against remaining macros. Vegan/dairy-free filtering is supported; users must verify allergen labels. Pantry quantities are snapshots and are not decremented when logging meals.

Photos are previewed locally, resized/re-encoded and discarded when the kitchen closes. They are never uploaded or saved in LocalStorage. **AI recognition is not connected**; ingredient confirmation is manual. This release does not add an AI backend, guided interval timers, live retailer feeds, global leaderboards, or new route-distance capabilities.

The storage upgrade adds default-empty `pantry` and `extraShopping` alongside the previous `runningPlans` and `healthMetrics`, preserving existing profiles, logs, routes and sessions. Existing running plans remain unchanged until reviewed or replaced. JSON export includes verified pantry data and plan history but no photos.

## iPhone behavior

After the site is published, open its **HTTPS URL in Safari**, tap Share → Add to Home Screen → Add. Open FitCraft from that icon. Menu wording can differ between iOS versions. Offline availability starts after the first successful online load and service-worker installation.

Safari cannot provide HealthKit access or reliable continuous background GPS. Keep the app visible and the screen on during a workout. Screen Wake Lock is requested where supported. Hiding Safari cancels in-progress segment timing and breaks distance continuity; elapsed time continues. Switching apps, locking the phone, refreshing or force-closing during an unfinished session can lose data. A completed workout is durable only after Save succeeds. Apple Watch heart rate is not available.

Clearing website data removes local progress. Export your data before changing devices. JSON export is a backup/download; a restore/import flow is not implemented in this version.

## Maps and external services

- Map tiles: `tile.openstreetmap.org`, with attribution. Tiles are not included in the offline cache.
- Routing: `routing.openstreetmap.de`, public FOSSGIS OSRM foot/bike endpoints. Actual length may differ from the requested loop, and paths may overlap. Inspect access and conditions before using a route.
- Nearby places: `overpass-api.de`. Query results depend on community map coverage.

These are public community services without an application-specific availability guarantee. Production scale needs suitable service agreements or self-hosted infrastructure and compliance with the providers' usage policies. Requests expose coordinates to the selected service. No coordinates are sent to a FitCraft backend. The Stockholm sample is illustrative and cannot be used to record a segment attempt.

## Tests

```sh
npm test
npm run build
CHROMIUM_PATH=/path/to/chromium npm run test:e2e
```

`npm test` runs 24 unit tests. The browser suite runs 18 end-to-end tests at an iPhone 13 viewport, covering onboarding, all tabs, workout completion, meal logging, shopping persistence, segment creation, successful/failed routing, GPS recording, offline relaunch and Home Screen/profile controls. GPS, routing and map tiles are controlled browser fixtures in these tests; they do not verify live provider availability or real outdoor GPS accuracy. Tests use Chromium, not actual iOS Safari.

## Hosting and publication

`.github/workflows/web.yml` builds and tests on changes, then saves a Pages artifact. Pushes to `main` only build/test. **After explicit publication approval**, pushing to the dedicated `fitcraft-web-publish` branch builds, tests and publishes the app. A manual workflow run with `publish` checked does the same. This makes the website public. Publication produces the authoritative URL in the deployment result. Before the first deployment, the repository owner must open Settings → Pages → Build and deployment and select **GitHub Actions** as the source. The workflow's integration token cannot create the Pages site itself.

The existing public site is **https://eskilsson96.github.io/PTapp/**. A successful GitHub Actions `publish` job is the deployment confirmation. The runtime may block direct requests to that Pages domain even when GitHub deployment succeeds. Refresh Safari online to fetch a newer release; do not clear website data to update.
