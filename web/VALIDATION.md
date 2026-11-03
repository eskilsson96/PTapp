# Web validation

Executed successfully in the supplied workspace:

- Production Vite build, targeting Safari 16 syntax: generated the app, hashed assets, manifest, icons and offline service worker.
- **17 unit tests passed**, with no failures or skipped tests: profile validation, equipment plans, progression, vegan substitutions, logged nutrition snapshots, shopping quantities, distances, ordered segment traversal, GPS accuracy and output escaping.
- **13 browser tests passed**, with no failures or skipped tests, in Chromium at iPhone 13 dimensions: onboarding/reload, all tabs/no horizontal overflow/no JS exceptions, workout completion, nutrition logging/undo, shopping/recipes, sample segments, successful/failed route integration, simulated outdoor recording/storage, offline relaunch and profile/Home Screen instructions.
- Visually inspected the dashboard screenshot from the browser run.

Browser GPS and third-party map/routing responses were test fixtures. Live mapping services, real outdoor accuracy, actual iOS Safari/Home Screen behavior, and public hosting have not been verified. Syntax targeting Safari does not substitute for a physical iPhone test.

The first browser run exposed three selector problems in the tests (a checkbox overlay, dynamically changing completion buttons and two elements with the status role). The selectors were corrected without weakening the behavior assertions; the complete suite then passed.

Hosting remains a separate step. A read-only check of the connected GitHub REST API returned `Forbidden`. No source was pushed and no public deployment was made. The dedicated publishing workflow is prepared, but neither its availability nor a public URL is claimed as verified.

Running-coach update: added reference VDOT/pace tests, goal-vs-benchmark separation, marathon-base validation, distinct-day/same-source readiness checks, legacy-storage preservation, and three browser flows for race planning and manual recovery. Production build and all 30 tests passed locally. Public deployment is verified separately through GitHub Actions.
