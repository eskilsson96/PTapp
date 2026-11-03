# Optional FitCraft read API

Set a public HTTPS base URL in Profile → Community & grocery service. No credentials should be embedded in this URL. The client uses ISO 8601 dates and JSON. It accepts only successful HTTP responses. This interface is an integration hook; no service is deployed by the project.

`GET /offers` returns:

```json
[
  {
    "id": "store-offer-123",
    "title": "Example product",
    "store": "Example market",
    "price": 19.9,
    "currency": "SEK",
    "validUntil": "2026-12-31T23:59:59Z"
  }
]
```

Only unexpired, nonnegative-price offers are displayed. Production feeds should come from authorized retailer APIs; this application contains no scraper. The example is a schema illustration, not a real offer.

`GET /segments/{segmentUUID}/leaderboard?period=allTime` or `period=monthly` returns up to ten entries:

```json
[
  {
    "id": "D448B69A-8DD1-4FC1-AF9A-19D58A5CD247",
    "athleteID": "DA484B83-E85A-4E80-B2D2-4C364E3774B2",
    "attemptID": "B97789E6-3BC2-4EAA-8685-B26F6435DD19",
    "displayName": "Example runner",
    "elapsedSeconds": 245.2,
    "achievedAt": "2026-11-02T12:00:00Z",
    "rank": 1
  }
]
```

Rank is server-authoritative. Entry UUIDs must be unique across segment, period, month and athlete; only one best time per athlete belongs in a board. Rank one on the all-time board owns the crown. The server must define tie-breaking. Monthly boundaries are UTC. Return an empty array if a segment has no published board. Local segment IDs must be registered by a future authenticated synchronization layer before a backend can recognize them.

Future authenticated APIs must establish account identity, publish versioned immutable segment geometry, upload attempts idempotently, validate original GPS samples and accuracy, reject impossible traversal and replay, and recompute boards transactionally. Never use an unverified local time to award a global crown. APNs support requires device-token registration, a trusted push provider and Apple provisioning. The current client offers a crown-loss alert after an explicit refresh; it does not register for remote push.
