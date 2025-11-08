Project: nestjs-mongo (NestJS)
# Dynamic UX MVP API — Current Backend Status

Base URL: `http://localhost:8081`

Authentication: JWT via `Authorization: Bearer <token>` (MVP note: key endpoints used by the React dashboard, including `/gemini/analyze-events`, accept requests without JWT.)

Swagger: `http://localhost:8081/api`

---

## Contracts — Quick Reference & Examples

- Canonical (public)
  - `GET /contracts/canonical` — latest canonical contract
    - Example: `curl -s http://localhost:8081/contracts/canonical | jq -r '[.version, .json.meta.appName] | @tsv'`
  - `GET /contracts/public/canonical` — alias of canonical
    - Example: `curl -s http://localhost:8081/contracts/public/canonical | jq -r '[.version, .json.meta.appName] | @tsv'`

- Merged (authenticated)
  - `GET /users/:id/contract` — merges canonical + personalized for user
    - Header: `Cache-Control: private, max-age=300`
    - Example:
      - `ACCESS_TOKEN=$(curl -s -X POST http://localhost:8081/auth/login -H 'Content-Type: application/json' -d '{"email":"test@example.com","password":"password123"}' | jq -r '.accessToken')`
      - `USER_ID=$(curl -s -X POST http://localhost:8081/auth/login -H 'Content-Type: application/json' -d '{"email":"test@example.com","password":"password123"}' | jq -r '.userId')`
      - `curl -s http://localhost:8081/users/$USER_ID/contract -H "Authorization: Bearer $ACCESS_TOKEN" | jq -r '[ (.json.pagesUI.pages.music.children[] | select(.type=="grid") | .columns), (.json.pagesUI.bottomNavigation.items[0].label) ] | @tsv'`

- Personalized snapshots (authenticated)
  - `GET /contracts/user/:userId` — latest personalized snapshot stored in `UserContract`
  - `POST /contracts/user/:userId` — upsert personalized snapshot (body: `{ contractId?, json }`)

- Contract creation (authenticated)
  - `POST /contracts` — create a contract record (canonical or user-targeted)
  - `POST /users/:id/contract` — create a user-targeted contract in the main `Contract` collection

### Validation Errors (Examples)
- `POST /contracts` with invalid JSON
  - Body:
    ```json
    { "json": {}, "version": "1.0.0", "meta": {} }
    ```
  - Response `400`:
    ```json
    {
      "error": {
        "code": "BAD_REQUEST",
        "message": "Invalid contract json",
        "details": {
          "message": "Invalid contract json",
          "errors": [
            "meta: Required section missing or invalid",
            "pagesUI: Required section missing or invalid"
          ]
        }
      }
    }
    ```
- `POST /users/:id/contract` with non-semver `version`
  - Body:
    ```json
    { "json": { "meta": {}, "pagesUI": { "pages": {} } }, "version": "v1", "meta": {} }
    ```
  - Response `400`:
    ```json
    {
      "error": {
        "code": "BAD_REQUEST",
        "message": "version must be semver string like 1.0.0"
      }
    }
    ```

- LLM generation (authenticated)
  - `POST /llm/generate-contract` — generate an optimized contract from a base and record it under target `userId`
  - `POST /gemini/generate-contract` — same flow via Gemini provider

### LLM Generation — Output Details
- Provider: Gemini (`llm.provider=gemini`).
- Prompts require a full contract JSON containing:
  - `meta` — includes `optimizationExplanation`, `generatedAt`, `isPartial=false`; backend stamps `meta.version`.
  - `pagesUI.pages` — authenticated-only pages; public pages excluded.
  - `thresholds` — numeric tuning values (e.g., `rageThreshold`, `rageWindowMs`, `repeatThreshold`, `repeatWindowMs`, `formRepeatWindowMs`, `formFailWindowMs`).
- Backend enforcement:
  - Sets `responseMimeType: application/json` and a `responseSchema` for the above sections.
  - If `thresholds` is missing, applies safe defaults.
  - Validates and persists the resulting JSON; on validation failure, retries once with correction prompt, then falls back to a safe partial.
- Example success response (simplified):
  ```json
  {
    "version": "1.0.4",
    "json": {
      "meta": {
        "optimizationExplanation": "Reordered Home cards and added helper text to reduce confusion.",
        "isPartial": false,
        "generatedAt": "2025-11-05T15:12:00.000Z",
        "version": "1.0.4"
      },
      "thresholds": {
        "rageThreshold": 3,
        "rageWindowMs": 1000,
        "repeatThreshold": 3,
        "repeatWindowMs": 2000,
        "formRepeatWindowMs": 10000,
        "formFailWindowMs": 10000
      },
      "pagesUI": {
        "pages": {
          "Home": { "id": "Home", "scope": "authenticated", "layout": "column", "children": [] }
        }
      }
    }
  }
  ```

Notes
- Caching keys: `contracts:canonical`, `contracts:user:{id}` with TTL 300s.
- See `docs/contracts-behavior.md` for end-to-end behavior, storage model, and seeding.

## Health

- `GET /ping`
  - Returns `{ "status": "ok" }` for health checks.

---

## Auth

- `POST /auth/register`
  - Registers a new user.
  - Body: `{ "email": "user@example.com", "username": "user", "name": "User", "password": "secret123" }`
  - Response: `{ "ok": true }`
  - Behavior: on success, the backend automatically assigns the latest canonical contract to the new user by creating a personalized snapshot seeded from the canonical. If no canonical exists, registration succeeds without creating a personalized contract.

- `POST /auth/login`
  - Logs in and returns JWT.
  - Body: `{ "email": "user@example.com", "password": "secret123" }`
  - Response: `{ "userId": "...", "role": "USER", "accessToken": "...", "refreshToken": "..." }`
  - Notes: For profile details (e.g., `name`, `username`), call `/users/me` with the JWT.

Notes:
- Uses `LocalAuthGuard` for credential validation.
- JWT is required for most non-auth endpoints; public exceptions are explicitly marked (e.g., `/contracts/canonical`, `/contracts/public/canonical`).

---

## Events

- Ingestion (public)
  - `POST /events` — batch insert tracking events (no authentication required in MVP).
  - `POST /events/tracking-event` — single tracking event insert (no authentication required in MVP).
  - Example:
    ```bash
    curl -s -X POST http://localhost:8081/events \
      -H 'Content-Type: application/json' \
      -d '{ "events": [ { "timestamp": "2025-11-02T12:00:00.000Z", "page": "home", "componentId": "btn_start", "eventType": "tap", "data": {} } ] }'
    ```
  - Behavior: if unauthenticated, events are stored under a fallback user id (`PUBLIC_EVENTS_USER_ID`, default `000000000000000000000000`).
  - Attribution: explicitly attribute events to a user by including `userId` in the request body.
    - For batch: supply `userId` at the top level of `CreateEventsBatchDto`.
    - For single: supply `userId` inside the `EventDto`.
    - This overrides the fallback and ensures `/users/:id/tracking-events` returns the same user’s events.
  - Example (explicit user mapping):
    ```bash
    curl -s -X POST http://localhost:8081/events \
      -H 'Content-Type: application/json' \
      -d '{ "userId": "6907c6ac6687063b0a45eea2", "events": [ { "timestamp": "2025-11-02T12:00:00.000Z", "page": "home", "componentId": "btn_start", "eventType": "tap", "data": {} } ] }'
    ```

- Aggregation (authenticated)
- `GET /events/aggregate` — returns aggregated stats; Public.
  - Header: `Authorization: Bearer <token>`
  - Query: `page`, `timeRange` (`all|24h|7d|30d`), optional `eventType`.

---

## Users

- `GET /users/me` (JWT)
  - Returns the current user profile.

- `GET /users` (JWT)
  - Returns all users.
  - Response DTO: `UserSummaryDto[]`
  - Fields:
    - `id` — string (Mongo `_id`)
    - `username` — string (optional)
    - `email` — string (optional)
    - `name` — string (optional)
    - `lastActive` — ISO timestamp
    - `contractVersion` — string (latest version for the user)

- `GET /users/:id` (JWT + ADMIN)
  - Returns a user by id.

- `GET /users/:id/contract` (JWT)
  - Returns the latest personalized contract for the user; if none exists, responds `404 Not Found` so clients can explicitly fall back to the latest canonical via `GET /contracts/public/canonical`.
  - Caching: `Cache-Control: private, max-age=300`; server-side Redis cache key `contracts:user:{id}` when Redis is configured for successful (200) responses.
  - Response DTO: `ContractDto` (includes `id`, `userId`, `version`, `json`, `createdAt`, `updatedAt`, `meta`).
  - Rationale: Aligns with Flutter client behavior which falls back to canonical on `404` from `/users/:id/contract`.
  - Versioning note: when a personalized contract exists, the merged `json.meta.version` is set to the personalized version so clients that read `meta.version` from the inner `json` surface the correct semantic version.

- `POST /users/:id/contract` (JWT + ADMIN)
  - Creates/updates the user’s latest contract.
  - Request DTO: `UpdateUserContractDto`
  - Response DTO: `ContractDto` (standardized to include `id` and `meta`).
  - Behavior: invalidates `contracts:user:{id}` cache on success.

- `GET /users/:id/tracking-events` (JWT)
  - Lists tracking events for a user; only owner or ADMIN can read.
  - Response DTO: `TrackingEventDto[]`
  - Notes:
    - `:id` is the user’s Mongo `_id`. User entities are documented with `id` only (no `userId` field on the User itself).
    - Related documents reference users via `userId` (e.g., `Event.userId`, `Session.userId`, `Contract.userId`). The backend returns events where `event.userId === :id`.
    - If events were recorded under the fallback `000000000000000000000000`, query that id directly or attribute via ingestion.

- `PATCH /users/:id` (JWT)
  - Updates fields of a user.

- `DELETE /users/:id` (JWT + ADMIN)
  - Deletes a user.

---

## Canonical Contracts

- `POST /contracts` (JWT)
  - Stores a canonical contract after validation.
  - Request DTO: `CreateContractDto`
  - Response DTO: `ContractDto`

- `GET /contracts/:id` (JWT)
  - Returns a contract by id.
  - Response DTO: `ContractDto`

- `GET /contracts/canonical` (Public)
  - Returns the latest canonical contract (no `userId`).
  - Caching: `Cache-Control: public, max-age=300`; server-side Redis cache key `contracts:canonical` when Redis is configured.
  - Response DTO: `ContractDto` (includes `id`, `version`, `json`, timestamps, `meta`).

- `GET /contracts/public/canonical` (Public, alias)
  - Alias of `/contracts/canonical` provided to avoid dynamic route collisions with guarded routes.
  - Identical response and caching behavior.
  - Recommended as a fallback when clients encounter `401`/`404` on `/contracts/canonical` due to environment-specific route conflicts.

- `GET /contracts/:id/history` (JWT + ADMIN)
  - Returns chronological history for the same target as the given contract id.
    - If the contract targets a user, returns all contracts for that user.
    - If canonical, returns all canonical contracts.
  - Response: array of items `{ ...ContractDto, diff }`, where `diff` summarizes JSON changes compared to the previous version: `{ added: Record<string, any>, removed: string[], updated: Record<string, { from: any; to: any }> }`.

---

## User-Personalized Contracts

- `GET /contracts/user/:userId` (JWT)
  - Returns the personalized contract for a user.
  - Response DTO: `UserPersonalizedContractDto`

- `POST /contracts/user/:userId` (JWT)
  - Upserts a personalized contract. Only the user or ADMIN may write.
  - Request DTO: `UpsertUserContractDto`
  - Response DTO: `UserPersonalizedContractDto`

---

## Events (Analytics)

- `POST /events` (JWT)
  - Inserts a batch of events attributed to the current JWT user.
  - Attribution: include `userId` at the top level to attribute to a specific user. In batch payloads, if an individual event includes `userId`, that per-event attribution is used for that event; otherwise it falls back to the batch-level `userId` or JWT user. When omitted, attribution uses the JWT user.
  - **Request Payload** (`CreateEventsBatchDto`):
    ```json
    {
      "events": [
        {
          "timestamp": "2023-10-03T10:00:00.000Z",
          "page": "onboarding",
          "componentId": "email-input",
          "eventType": "input",
          "data": { "value": "user@example.com" },
          "sessionId": "651c0e89b4e91e5eb2a9c1fa"
        },
        {
          "timestamp": "2023-10-03T10:00:01.000Z",
          "componentId": "submit-btn",
          "eventType": "tap"
        }
      ]
    }
    ```
  - **Response** (`InsertedCountDto`): `{ "inserted": 2 }`

- `POST /events/tracking-event` (JWT)
  - Inserts a single tracking event for the current JWT user.
  - Attribution: optionally include `userId` inside the event payload to attribute to a specific user. When omitted, attribution uses the JWT user.
  - **Request Payload** (`EventDto`):
    ```json
    {
      "timestamp": "2023-10-03T10:00:05.000Z",
      "componentId": "submit-btn",
      "eventType": "error",
      "data": { "message": "Invalid email format" }
    }
    ```
  - **Response** (`InsertedCountDto`): `{ "inserted": 1 }`

- `GET /events/user/:userId` (Public)
  - Lists events for a specific user. Only the user or ADMIN may read.
  - Response DTO: `TrackingEventDto[]`

---

## LLM

- `POST /llm/generate-contract` (Public)
  - **Process**: This endpoint generates and persists an optimized contract by first aggregating user analytics. It checks for a cached summary (`llm:analytics:{userId}`), and if not found, computes and caches it. The analytics include pain points (e.g., rage clicks, error patterns) and usage stats. This data is used to build a prompt for the configured LLM provider (`gemini`, `openai`, etc.). If the provider call succeeds, the new contract is persisted; otherwise, a heuristic fallback is used. The resulting contract `meta` field includes `optimizationExplanation` and `analytics` from the generation process when available.
  - **Technical flow**:
    - Validate `GenerateContractRequestDto` and user authorization.
    - Load analytics from Redis (`llm:analytics:{userId}`) or compute via `EventService`.
    - Compose prompt with `baseContract.meta` and detected pain points.
    - Call provider (`GeminiClient`) when configured; on failure, use heuristic fallback.
    - Validate contract JSON, persist via `ContractService`, return `ContractDto`-like response.
  - **Request Payload** (`GenerateContractRequestDto`):
    ```json
    {
      "userId": "64f5b7e86831d4f215d7b8d4",
      "baseContract": {
        "meta": { "description": "Base contract to optimize." },
        "pagesUI": { "pages": {} }
      },
      "version": "1.2.0"
    }
    ```
  - **Response** (`ContractDto`):
    ```json
    {
      "id": "651c0f0a1d6d7e6a4e3b1c6d",
      "userId": "64f5b7e86831d4f215d7b8d4",
      "version": "1.2.1",
      "json": { /* ... optimized contract ... */ },
      "createdAt": "2023-10-03T10:00:00.000Z",
      "updatedAt": "2023-10-03T10:00:00.000Z",
      "meta": {
        "optimizedBy": "gemini",
        "optimizedByModel": "gemini-2.5-flash",
        "optimizationExplanation": "Identified user confusion around the 'submit' button and replaced it with a clearer stepper component.",
        "analytics": {
          "errorRate": 0.15,
          "painPoints": [
            { "type": "rage-click", "componentId": "submit-btn", "reason": "3 taps in 980ms" }
          ]
        }
      }
    }
    ```
  - Behavior: aggregates analytics for the target user, including `eventTypeDistribution`, `errorRate`, and pain points.
  - Pain points: `rage-click`, `form-abandonment`, `error-pattern`, `long-dwell`.
  - Caching: analytics summary cached under Redis key `llm:analytics:{userId}` with TTL 300 seconds (if Redis is configured).
  - Note: In the current code, the controller returns a subset of `ContractDto` (may omit `id` and `meta`) while Swagger types the response as `ContractDto`. The example above reflects the intended standardized shape.
  - Provider: when `LLM_PROVIDER=gemini` and `GEMINI_API_KEY` are configured, Gemini is used; otherwise a heuristic fallback embeds `analytics.eventCounts`.

### Gemini (Queue)

- `POST /gemini/generate-contract` (Public)
  - **Process**: Validates input and checks the Gemini circuit breaker state. If closed, enqueues a generation job in the queue and returns `202 Accepted` with the job ID. The processor will compute analytics (with Redis cache for `llm:analytics:{userId}`), call Gemini, persist the contract, and attach generation metadata. If the circuit is open (e.g., due to repeated failures), responds with `503 Service Unavailable`.
  - **Request Payload** (`EnqueueGeminiJobDto`):
    ```json
    { "userId": "64f5b7e86831d4f215d7b8d4", "priority": 5 }
    ```
  - **Response** (`EnqueueJobResponseDto`):
    ```json
    { "jobId": "gem-8a74b7d0-9f1e-4e37-b7c0-29b1b060c3bb", "message": "Accepted" }
    ```
  - Circuit breaker: `503` with body `{ "error": { "code": "CIRCUIT_OPEN", "message": "Gemini temporarily disabled" } }`.
  - **Notes**:
    - Prompt guardrails enforce non-trivial changes: the optimization prompt requires at least one concrete modification to `pagesUI` compared to the current contract (e.g., tweak labels, reorder items, adjust grid columns, add helper text). This prevents identical output.
    - Returned JSON is partial and authenticated-only; `meta.optimizationExplanation` contains concise reasoning.

- `GET /gemini/jobs/:jobId` (Public)
  - **Process**: Reads job state from the queue store and returns status, progress, timestamps, and result/error when available.
  - **Response** (`GeminiJobStatusDto`):
    ```json
    {
      "id": "gem-8a74b7d0-9f1e-4e37-b7c0-29b1b060c3bb",
      "status": "completed",
      "progress": 100,
      "result": {
        "contractId": "651c0f0a1d6d7e6a4e3b1c6d",
        "version": "1.2.1",
        "explanation": "Identified confusion around CTA; replaced with clearer stepper."
      },
      "error": null,
      "timestamps": {
        "createdAt": "2023-10-03T10:00:00.000Z",
        "startedAt": "2023-10-03T10:00:02.000Z",
        "completedAt": "2023-10-03T10:00:08.000Z"
      }
    }
    ```
  - Status values: `queued`, `processing`, `completed`, `failed`.
  - Notes:
    - The `result.explanation` is included when the processor returns `meta.optimizationExplanation` during contract persistence. Clients may display this directly without fetching the contract.

- `POST /gemini/circuit-breaker/reset` (Public)
  - **Process**: Forces the circuit breaker to a closed state, allowing new jobs to enqueue.
  - **Response**:
    ```json
    { "success": true }
    ```

 - `POST /gemini/analyze-events` (Public)
  - **Process**: Analyzes recent tracking events for a given user id and returns top UX pain points.
    - Fetches last 7 days of events (up to 100) via `EventService.getRecentEvents`.
    - If no events are found in the last 7 days, widens the window to all available events (up to 100) and proceeds with analysis when events exist.
    - Builds a structured JSON-only prompt and calls Gemini using the configured model via `ConfigService.get('llm.gemini.model')`, defaulting to `gemini-2.5-flash`.
    - Parses provider output strictly (`parseJsonStrict`) and returns `painPoints`, `improvements`, `eventCount`, and `timestamp`.
    - If no events exist at all for the user, returns empty arrays for `painPoints` and `improvements` and a `message`.
  - **Auth**: No JWT required in MVP.
  - **Request Payload** (`AnalyzeEventsRequestDto`):
    ```json
    { "userId": "64f5b7e86831d4f215d7b8d4" }
    ```
  - **Response** (`AnalyzeEventsResponseDto`):
    ```json
    {
      "painPoints": [
        {
          "title": "Users rapidly tap Submit",
          "description": "Repeated taps within 1s indicate confusion around the CTA.",
          "elementId": "submit-btn",
          "page": "checkout",
          "severity": "high"
        }
      ],
      "improvements": [
        {
          "title": "Replace Submit with clearer Continue CTA",
          "description": "Use a stepper and clarify copy to reduce rapid taps.",
          "elementId": "submit-btn",
          "page": "checkout",
          "priority": "high"
        }
      ],
      "eventCount": 47,
      "timestamp": "2025-11-02T12:34:56.000Z"
    }
    ```
  - **Example**:
    ```bash
    curl -s -X POST http://localhost:8081/gemini/analyze-events \
      -H 'Content-Type: application/json' \
      -d '{ "userId": "64f5b7e86831d4f215d7b8d4" }'
    ```
  - **Notes**:
    - Pain points are returned as `{ title, description, elementId?, page?, severity }`.
    - Improvements are returned as `{ title, description, elementId?, page?, priority }`.
    - Prompt strengthened for quality:
      - When events exist (`eventCount > 0`), return at least one pain point and one improvement (never empty arrays).
      - Deduplicate by `(elementId + page + event type)` and ground all insights strictly in provided events (no invented IDs).
      - Severity mapping guidelines: rage-click/error/form-abandonment = `high`; long-dwell = `medium`; others default to `medium`.
      - Items are concise and actionable: short titles and one-sentence descriptions.
    - Invalid LLM output (missing `painPoints` or `improvements` arrays) yields `400 Bad Request`.
    - Model selection uses `llm.gemini.model` from configuration (`GEMINI_MODEL`), defaulting to `gemini-2.5-flash`.
    - Only `userId` is accepted in requests.

 - `POST /gemini/analyze-events/job` (Public)
  - **Process**: Enqueues an analyze-events job for the target user and returns `202 Accepted` with the job ID. The worker fetches events, calls Gemini (or returns a heuristic fallback), and returns a JSON result via job status.
  - **Request Payload** (`EnqueueAnalyzeEventsJobDto`):
    ```json
    { "userId": "64f5b7e86831d4f215d7b8d4", "priority": 5, "since": "2025-01-01T00:00:00.000Z", "limit": 100 }
    ```
  - **Response** (`EnqueueJobResponseDto`):
    ```json
    { "jobId": "an-01b4c2d0-7b1e-4e37-b7c0-29b1b060c3bb", "message": "Accepted" }
    ```
  - Circuit breaker: if Gemini circuit is open, responds with `503 Service Unavailable`.

 - `GET /gemini/analyze-events/jobs/:jobId` (Public)
  - **Process**: Reads job state for analyze-events and returns status, progress, timestamps, and the analysis result or error.
  - **Response** (`GeminiJobStatusDto`):
    ```json
    {
      "id": "an-01b4c2d0-7b1e-4e37-b7c0-29b1b060c3bb",
      "status": "completed",
      "progress": 100,
      "result": {
        "painPoints": [ { "title": "Users rapidly tap Submit", "description": "Repeated taps within 1s indicate confusion around the CTA.", "elementId": "submit-btn", "page": "checkout", "severity": "high" } ],
        "improvements": [ { "title": "Replace Submit with clearer Continue CTA", "description": "Use a stepper and clarify copy to reduce rapid taps.", "elementId": "submit-btn", "page": "checkout", "priority": "high" } ],
        "eventCount": 47,
        "timestamp": "2025-11-02T12:34:56.000Z"
      },
      "error": null,
      "timestamps": {
        "createdAt": "2023-10-03T10:00:00.000Z",
        "startedAt": "2023-10-03T10:00:02.000Z",
        "completedAt": "2023-10-03T10:00:08.000Z"
      }
    }
    ```

---

## Error Format

Global filter standardizes errors to:
```json
{
  "error": {
    "code": "<ERROR_CODE>",
    "message": "<human readable>",
    "details": { /* optional */ }
  },
  "requestId": "<optional>"
}
```

Common statuses:
- 400: Validation errors (DTO or contract schema)
- 401: Missing/invalid JWT (applies only to protected auth endpoints)
- 403: Unauthorized action (role or ownership)
- 404: Resource not found

---

## Sessions

- `POST /sessions/start` (Public)
  - Starts a session for the authenticated user.
  - Request DTO: `CreateSessionDto`
  - Response DTO: `SessionDto`
  - Request may include optional `platform` (e.g., `web`, `ios`, `android`).

- `POST /sessions/:id/end` (Public)
  - Ends a session; only owner or ADMIN can end.
  - Response DTO: `SessionDto`

- `GET /sessions/user/:userId` (Public)
  - Lists sessions for a user; only owner or ADMIN.
  - Response DTO: `SessionDto[]`

- `GET /sessions/:id` (Public)
  - Returns a session with its associated events.
  - Response DTO: `SessionWithEventsDto`
  - Responses include optional `platform` when provided at session start.

Notes:
- Events now accept optional `sessionId`, allowing analytics grouping by session.
- Frontend may generate session IDs or rely on backend to manage session lifecycle.
 - Registration uses validated DTOs; `email`, `username`, and `password` (min 6) are required.

---

## Notes

- Posts module/endpoints have been removed; the backend focuses on auth, users, canonical contracts, and event collection.
- See Swagger at `/api` for complete schemas.
  - Debug logging (server): endpoints log `body.userId`, `req.user.userId`, and the final resolved `userId` used for attribution.
    - Batch example log:
      `POST /events batch: events=2, bodyUserId=507f1f77bcf86cd799439011, jwtUserId=null, resolvedUid=507f1f77bcf86cd799439011`
    - Single example log:
      `POST /events/tracking-event: eventType=tap, componentId=btn1, bodyUserId=null, jwtUserId=null, resolvedUid=000000000000000000000000`
    - Service summary:
      `EventService.createBatch: inserted=2, batchUid=507f1f77bcf86cd799439011`