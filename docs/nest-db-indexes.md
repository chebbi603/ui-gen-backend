# Database Indexes (Performance Optimization)

This document describes the MongoDB indexes added to improve query performance in the `nestjs-mongo` project and how to verify them in MongoDB Atlas/Compass.

## Indexes Added

- User collection (`UserSchema`)
  - `email` unique index: `{ email: 1, unique: true }`
  - `username` index: `{ username: 1 }`

- Event collection (`EventSchema`)
  - Compound: `{ userId: 1, sessionId: 1, timestamp: 1 }` (existing)
  - Compound: `{ userId: 1, timestamp: -1 }` (list user events sorted by time desc)
  - Single: `{ timestamp: -1 }` (time-range queries and latest-event lookups)
  - Optional: `{ eventType: 1, timestamp: -1 }` (type filtering + chronological)

- Contract collection (`ContractSchema`)
  - Single: `{ version: 1 }` (version-based lookups and ordering)
  - Compound: `{ userId: 1, createdAt: -1 }` (latest-per-user and chronological history)
  - Single: `{ createdAt: -1 }` (global latest contract)

## Code References

- `src/modules/user/entities/user.entity.ts`
- `src/modules/event/entities/event.entity.ts`
- `src/modules/contract/entities/contract.entity.ts`

Indexes are defined via `Schema.index(...)` so they are created automatically in development (depending on Mongoose `autoIndex` behavior) and visible in Atlas/Compass.

## Query Patterns and Rationale

- User
  - `findOne({ email })` and uniqueness checks on email during signup → indexed unique `email`.
  - Potential admin/user lookups by `username` → non-unique `username` index.

- Event
  - `find({ userId }).sort({ timestamp: -1 })` for user history → `{ userId: 1, timestamp: -1 }`.
  - `findOne({ userId }).sort({ timestamp: -1 })` to get latest → covered by above and `{ timestamp: -1 }`.
  - Filter by `eventType` for analytics (common in aggregations) → `{ eventType: 1, timestamp: -1 }`.

- Contract
  - Latest per user: `findOne({ userId }).sort({ createdAt: -1 })` → `{ userId: 1, createdAt: -1 }`.
  - Global latest: `findOne().sort({ createdAt: -1 })` → `{ createdAt: -1 }`.
  - Version-based lookups: `{ version: 1 }`.

## Verification (Atlas/Compass)

1. Start the application normally (do not change env vars).
2. In Atlas, open the cluster → Collections → select the database and the relevant collections (`users`, `events`, `contracts`).
3. Open the Indexes tab; you should see the new indexes listed with appropriate keys and types.
4. In MongoDB Compass:
   - Connect to the same Atlas cluster.
   - Navigate to each collection → Indexes tab to confirm presence.

## Explain Plans (Index Utilization)

You can verify index usage using MongoDB's `explain()`:

```
// Events: by user, sorted desc by timestamp
db.events.explain('executionStats')
  .find({ userId: ObjectId('507f1f77bcf86cd799439011') })
  .sort({ timestamp: -1 })

// Contracts: latest per user
db.contracts.explain('executionStats')
  .find({ userId: ObjectId('507f1f77bcf86cd799439011') })
  .sort({ createdAt: -1 })

// Users: email lookup
db.users.explain('executionStats')
  .find({ email: 'a@b.c' })
```

Check `winningPlan` and `executionStats.totalDocsExamined`. Good index usage shows `IXSCAN` and low docs examined.

## Success Metrics

- Email lookups complete in under `10ms`.
- Event history queries for a user with 1000+ events complete in under `200ms`.
- Index creation is logged on application startup without errors (Mongoose ensures indexes in dev).

## Operational Notes

- No environment variables were changed as requested.
- In production environments, consider managing indexes via migrations or Atlas UI if `autoIndex` is disabled.
- Monitor Atlas Performance Advisor and slow query logs over time; add/remove indexes as usage patterns evolve.