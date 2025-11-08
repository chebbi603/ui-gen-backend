# Debug Reference: Current Implementation (Contracts, Events, Analytics, Jobs)

This document enumerates the actual implemented behavior with file paths, routes, cache keys, TTLs, and job status mappings, for debugging and tracing.

## Files and Modules (paths)
- Auth: `src/modules/auth/services/auth.service.ts`
- Users: `src/modules/user/controllers/user.controller.ts`
- User-Contracts: `src/modules/user-contract/controllers/user-contract.controller.ts`, `.../services/user-contract.service.ts`
- Contracts: `src/modules/contract/services/contract.service.ts`, `.../services/contract-merge.service.ts`, `.../services/flutter-contract-filter.service.ts`
- Events: `src/modules/event/controllers/event.controller.ts`, `.../services/event.service.ts`, `.../entities/event.entity.ts`
- Cache: `src/common/services/cache.service.ts`
- Gemini: `src/modules/llm/services/gemini.service.ts`, `src/modules/queue/controllers/gemini.controller.ts`, `src/modules/queue/processors/gemini-generation.processor.ts`, `src/modules/queue/processors/analyze-events.processor.ts`, `src/modules/queue/queue.service.ts`, `src/modules/queue/queue.constants.ts`

## Registration (AuthService.signUp)
- File: `src/modules/auth/services/auth.service.ts`
- Behavior:
  - Creates user via `userService.create(dto)`.
  - Fetches the created user with `findByEmail(email)` to get `_id`.
  - Retrieves canonical via `contractService.findLatestCanonical()`.
  - If canonical exists, calls `contractService.create(canonical.json, '0.0.0', meta, createdId, createdId)`.
  - `meta` additions: `source: 'auto-register'`, `baseVersion: canonical.version`, `assignedAt: <ISO>`.
  - Exceptions during contract creation are caught; registration proceeds without throwing.

## Contracts via UserController
- File: `src/modules/user/controllers/user.controller.ts`
- `GET /users/:id/contract`
  - Validates user existence (`NotFoundException` if missing).
  - Cache read: key `contracts:user:{id}` via `CacheService.get`; if present, returns cached value.
  - Loads `personalized = ContractService.findLatestByUser(id)` and `canonical = ContractService.findLatestCanonical()`.
  - If neither exists, returns `null` (no throw).
  - If personalized exists:
    - Merges `canonical.json` with `personalized.json` via `ContractMergeService.mergeContracts`.
    - Filters for Flutter via `FlutterContractFilterService.filterForFlutter`.
    - Rewrites `filteredJson.meta.version` to personalized version when available.
    - Response `ContractDTO` uses canonical `_id`, `version = personalized.version || canonical.version`, `json = filteredJson`, dates from canonical, `meta = canonical.meta`.
    - Cache write: `CacheService.set(cacheKey, res, 300)` (TTL 300 seconds). Header: `Cache-Control: private, max-age=300`.
  - If merge fails or personalized missing: throws `NotFoundException('Personalized contract not found')`.
- `POST /users/:id/contract`
  - Creates a new contract doc via `ContractService.create(json, version, meta, requesterId, id)`.
  - Returns created `ContractDTO` from doc.
  - Cache invalidation: `CacheService.del('contracts:user:{id}')`.

## User-Contracts Controller
- File: `src/modules/user-contract/controllers/user-contract.controller.ts`
- `GET /contracts/user/:userId`
  - Returns latest `UserContract` document for user or `{ json: null }` if none.
- `POST /contracts/user/:userId`
  - Validates `json` via `validateContractJson`.
  - Upserts `UserContract` with optional `contractId` filter.
  - No cache invalidation is performed here.

## Cache Service
- File: `src/common/services/cache.service.ts`
- Config keys: `redis.url`, `redis.host`, `redis.port`, `redis.password`, `redis.db`.
- `ensureClient()` lazy-connects to Redis; on failure, caching is disabled.
- `get(key)` returns parsed JSON or `null`.
- `set(key, value, ttlSeconds)` requires TTL; uses `EX` (seconds).
- `del(key)` deletes a key.
- Known callers/keys:
  - UserController: `contracts:user:{id}` read/write TTL 300; delete on `POST /users/:id/contract`.
  - GeminiGenerationProcessor: `del('contracts:user:{userId}')` after generation.
  - SeedService: deletes `contracts:user:{userId}` during seeding.
  - EventService.aggregateByPage: writes `events:aggregate:{page}:{timeRange}:{eventType|'all'}` with TTL 900.

## Events Controller
- File: `src/modules/event/controllers/event.controller.ts`
- `POST /events`
  - Resolves candidate userId precedence: top-level `body.userId` → first `body.events[0].userId` → `req.user.userId` → `process.env.PUBLIC_EVENTS_USER_ID` → `'000...000'`.
  - Validates candidate as ObjectId; else falls back to env or `'000...000'`.
  - Calls `EventService.createBatch(uid, body.events)`.
- `POST /events/tracking-event`
  - Resolves candidate userId precedence: `body.userId` → `req.user.userId` → env → `'000...000'`.
  - Logs event details and resolved uid; calls `createBatch(uid, [body])`.
- `GET /events/aggregate`
  - Calls `EventService.aggregateByPage(page, timeRange, eventType)`.

## Event Service
- File: `src/modules/event/services/event.service.ts`
- `createBatch(userId, events[])`
  - Maps each event to doc with `userId` (ObjectId), `timestamp` (Date), `page`, `componentId`, `eventType`, `data` (default `{}`), `sessionId` (optional ObjectId).
  - Tracks override vs fallback counts when `events[*].userId` differs from batch `userId`.
  - Inserts via `insertMany(docs)`; logs counts; returns `{ inserted: docs.length }`.
- `listByUser(requesterId, requesterRole, userId)`
  - Returns `find({ userId: ObjectId(userId) }).sort({ timestamp: -1 })`.
  - No role-based restriction in current implementation.
- `getRecentEvents(userId, since, limit=100)`
  - Returns `[{ eventType, elementId: componentId, timestamp: ISO, sessionId?, page? }]`.
- `aggregateByPage(page, timeRange, eventType?)`
  - Builds `match` by page, optional eventType, and time range (24h, 7d, 30d, all).
  - Metrics: `totalEvents`, `eventTypeCounts`, `uniqueUsers`, `averageSessionDurationSec` (min/max per session), `topComponents` (tap/input/navigate), `errorRatePercent`, `topErrorMessages`, `rageClickComponents` (≥3 taps in 1-second windows).
  - Cache read/write: key `events:aggregate:{page}:{timeRange}:{eventType|'all'}` with TTL 900.

## Gemini Controller and Queue Service
- Files: `src/modules/queue/controllers/gemini.controller.ts`, `src/modules/queue/queue.service.ts`, `src/modules/queue/queue.constants.ts`
- Endpoints:
  - `POST /gemini/generate-contract` → enqueues gemini-generation job; returns `{ jobId, message: 'Accepted' }`. Validates user existence and circuit breaker.
  - `GET /gemini/jobs/:jobId` → returns job status or `404`.
  - `POST /gemini/circuit-breaker/reset` → resets circuit breaker.
  - `POST /gemini/analyze-events` → immediate analysis; returns `{ painPoints, improvements }`.
  - `POST /gemini/analyze-events/job` → enqueues analyze-events job.
  - `GET /gemini/analyze-events/jobs/:jobId` → returns status or `404`.
- Queue names/types: `GEMINI_GENERATION_QUEUE = 'gemini-generation'`, `ANALYZE_EVENTS_QUEUE = 'analyze-events'`.
- Status mapping (BullMQ → simplified):
  - `waiting|delayed|paused` → `pending`; `active|stalled` → `processing`; `completed` → `completed`; `failed` → `failed`; else `unknown`.
  - Returned fields: `{ id, status, progress, result, error, timestamps: { createdAt, startedAt, completedAt } }`.
- Connection:
  - Uses Redis connection from `redis.*` config; lazy connect; cleans old jobs (completed/failed) based on `queue.cleanup.*` config.

## Gemini Generation Processor
- File: `src/modules/queue/processors/gemini-generation.processor.ts`
- Behavior:
  - Creates `LlmJob` with `status='processing'`, `progress=0`, `startedAt`, `model` from `llm.gemini.model`.
  - Calls `llmService.generateOptimizedContract({ userId, baseContract, version })`.
  - Writes `requestPayload` and `responseText` to `LlmJob` when available.
  - Validates JSON via `ContractValidationService.validate`.
  - Persists contract via `contractService.create(json, nextVersion, meta, userId, userId)`.
  - Upserts user-contract link via `userContractService.upsertUserContract(userId, contract._id, contract.json, userId, 'ADMIN')`.
  - Cache invalidation: `cache.del('contracts:user:{userId}')`.
  - Updates `LlmJob` to `status='completed'`, `progress=100`, sets `reasoning` from `contract.meta.optimizationExplanation`, `contractId`, timestamps.
  - On error: sets `status='failed'`, `errorMessage`, `progress=0`, optionally `job.discard()` when not retryable (based on message).
  - Result fields: returns `{ contractId, version, explanation, originalSnapshot }` to the queue result. `originalSnapshot` is the provided `baseContract` when present; otherwise it is the latest personalized contract used as the starting point.
  - Repair-first strategy: the generation service sanitizes LLM output for Flutter compatibility and validates it; if invalid, it deterministically repairs schema and content via `ContractRepairService` (copying authenticated/private pages from the base when needed, applying default thresholds, removing unknown top-level props). When repair succeeds, it bumps the patch version and enforces `meta.isPartial=false`.
  - Explanation diff: the service appends a concise diff of changes to `meta.optimizationExplanation` via `ContractDiffService.explainChanges(before, after)`, alongside a sanitization summary indicating excluded public pages and removed/normalized components.

## Environment Variables / Config Keys
- `PUBLIC_EVENTS_USER_ID` used for event attribution fallback and various controllers.
- Redis: `redis.url`, `redis.host`, `redis.port`, `redis.password`, `redis.db`.
- Queue cleanup: `queue.cleanup.completedMs`, `queue.cleanup.failedMs`; job default options `queue.gemini.*`.
- LLM model: `llm.gemini.model`.

## Cache Interaction Notes (staleness)
- `GET /users/:id/contract` writes cache with TTL 300.
- `POST /users/:id/contract` invalidates `contracts:user:{id}`.
- `POST /contracts/user/:userId` does not invalidate `contracts:user:{id}` (potential stale cache until TTL expiry or other invalidation).

## Logging Clues
- `EventController.createSingleEvent` logs eventType, componentId, alias, jwtUser, candidate, resolvedUid.
- QueueService logs job lifecycle events (`waiting`, `added`, `active`, `completed`, `failed`, `stalled`).