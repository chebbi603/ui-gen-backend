# NestJS Backend — Data Flow and Architecture

This document clarifies how the Nest backend processes requests, stores and aggregates events, manages user contracts, and orchestrates Gemini jobs for contract generation and event analysis.

## Overview

- Tech: NestJS + TypeScript, MongoDB (Mongoose), BullMQ for job queues.
- Domains: Users, Events, Contracts, LLM (Gemini) analysis & generation.
- Key behavior: Robust request handling with fallbacks (public user), caching for contracts, safe merging/filtering for Flutter clients.

## Primary Controllers and Routes

### EventController (`/events`)

- `POST /events` — Batch insert of tracking events.
  - Resolves `userId` from body, first event, JWT user, or `PUBLIC_EVENTS_USER_ID`.
  - Validates `ObjectId` format; falls back to `PUBLIC_EVENTS_USER_ID` if invalid.
  - `EventService.createBatch(uid, events)` persists.
- `POST /events/tracking-event` — Insert a single event.
  - Same `userId` resolution and validation.
  - Logs diagnostic details for audit.
  - Uses `EventService.createBatch(uid, [body])`.
- `GET /events/aggregate` — Aggregate stats by page/timeRange/eventType.
  - Delegates to `EventService.aggregateByPage(page, timeRange, eventType)`.

### UserController (`/users`)

- `GET /users` — Lists user summaries.
  - For each user: finds last event (`EventService.getLastForUser`) and latest personalized contract (`ContractService.findLatestByUser`).
  - Returns `{ id, username, email, name, lastActive, contractVersion }`.
- `GET /users/me` — Current user info; falls back to public user when no JWT.
- `GET /users/:id` — Get a user document by id.
- `GET /users/:id/contract` — Latest effective contract for user.
  - Cache checked first (`CacheService`).
  - Retrieves personalized + canonical contracts from `ContractService`.
  - If personalized exists: merges canonical + personalized via `ContractMergeService`.
  - Filters merged JSON for Flutter with `FlutterContractFilterService`.
  - Writes to cache for 300s and returns filtered, versioned payload.
  - On merge errors, gracefully falls back to canonical filtered JSON.
- `POST /users/:id/contract` — Create/update personalized contract.
  - `ContractService.create(json, version, meta, requesterId, userId)`.
  - Returns created doc and invalidates `contracts:user:{id}` cache key.
  - On signup (AuthService): a personalized snapshot is auto-created from the latest canonical with `version` initialized to `0.0.0` and `meta.baseVersion` set to the canonical version used.
- `GET /users/:id/tracking-events` — List user’s tracking events.
  - Validates `ObjectId` and returns events for the target user, regardless of requester.
  - Maps event docs to DTO (`TrackingEventDTO`).

### GeminiController (`/gemini`)

- `POST /gemini/generate-contract` — Enqueue contract generation for a user.
- `GET /gemini/jobs/:jobId` — Check job status.
- `POST /gemini/analyze-events` — Directly analyze a user’s events (no queue).
- `POST /gemini/analyze-events/job` — Enqueue event analysis job.
- `GET /gemini/analyze-events/jobs/:jobId` — Check analysis job status.
- `POST /gemini/circuit-breaker/reset` — Operational reset if needed.

## Services and Processors

### QueueService

- Initializes BullMQ queues for generation and analysis.
- `addGeminiGenerationJob(userId)`, `addAnalyzeEventsJob(userId)` — Enqueue jobs with data.
- `getGeminiJobStatus(jobId)`, `getAnalyzeJobStatus(jobId)` — Map BullMQ states to `{ status, result }` with a normalized interface.
- Binds listeners for `stalled`, `error`, `waiting`, `active`, `completed`, `failed` for observability.

### gemini-generation.processor

- Input: `{ userId }` (and internal context).
- Steps:
  - Use `LlmService` to generate an optimized contract JSON with explanation.
  - Validate and persist via `ContractService` and `UserContractService`.
  - Update `LlmJob` entity with progress/status.
  - Persist raw LLM interaction: store `requestPayload` and `responseText` into `LlmJob` for auditability.
  - Return `{ contractId, version, explanation }` to the queue as `returnvalue`.
- Errors: Logged, marked failed with retryability flag.

#### LLM Pipeline Updates (2025-11-08)
- Prompts: Gemini prompts explicitly forbid introducing new component types/properties and public pages.
- Schema hardening: Response schema requires `version`, `meta`, `pagesUI`, `thresholds` and applies `additionalProperties: false` at the top level, within `meta`, and within `pagesUI`; `thresholds` values must be numeric.
- Sanitization: Raw LLM JSON is sanitized using `FlutterContractFilterService` to drop unsupported types and normalize aliases (`progressBar` → `progressIndicator`, `text_field` → `textField`).
- Scope enforcement: Only authenticated pages are retained; public pages are suppressed during generation.
- Suppression log: Differences between raw output and sanitized JSON are summarized and prepended to `meta.optimizationExplanation` (includes excluded pages, removed components, and normalizations).
- Validation & fallback: Sanitized JSON is validated; on failure (after retry), the system falls back to the last valid contract with authenticated-only pages, default thresholds, and a bumped patch version.

### analyze-events.processor

- Input: `{ userId }`.
- Steps:
  - Read user events and call `GeminiService` for UX analysis.
  - Update `LlmJob` entity.
  - Return `{ painPoints, improvements, eventCount, timestamp, message? }`.
- Errors: Logged with safe failure handling.

## Contracts: Merge, Filter, Cache

- Merge: `ContractMergeService.mergeContracts(canonical.json, personalized.json)` to produce an effective contract.
- Filter: `FlutterContractFilterService.filterForFlutter(mergedJson)` trims JSON to the subset the Flutter app expects.
- Cache: `CacheService` stores merged results for 5 minutes under `contracts:user:{id}` to reduce load and latency.

## Event Models and DTOs

- `TrackingEventDTO` provides API shape for frontend use: `{ id, userId, eventType, timestamp, page, component, payload, sessionId }`.
- `AggregateQueryDto` / `AggregateResultDto` represent aggregate inputs/outputs used by analytics reporting.
- `ContractDTO` returns versioned JSON with metadata and ISO timestamps.
 - `LlmJob` includes `requestPayload` (object) and `responseText` (string) fields to log Gemini requests/responses for debugging and audit.

## Resilience, Security, and Defaults

- Public user fallback: When JWT is missing or `userId` is invalid, `PUBLIC_EVENTS_USER_ID` (env) is used to ensure events can still be recorded.
- ObjectId validation: Guards against casting errors and malformed IDs in controllers.
- Logging: Controllers and processors log key events and job transitions.
 - Generation ensures `json.version` is stamped and `thresholds` exist before validation/persistence.

## Testing

- E2E tests reside under `test/` (e.g., `app.e2e-spec.ts`, `contracts.e2e-spec.ts`, `contracts.post.e2e-spec.ts`).
- Tests validate routing, contract creation/retrieval, and general app health.
- Test results summary maintained in `docs/nest-test-results.md`.

## Operational Notes

- `app.module.ts` wires modules, configuration, queue setup, and global providers.
- `llm.module.ts` encapsulates Gemini client/service wiring.
- `event.controller.ts` and `user.controller.ts` are the primary API surfaces for the React dashboard.

## Extension Ideas

- Add per-user analysis caching keyed by event hash to speed repeated analyses.
- Extend aggregate API with component-level breakdowns and severity bins.
- Enrich `ContractDTO.meta` with provenance and diff stats when generated by Gemini.