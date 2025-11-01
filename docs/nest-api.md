Project: nestjs-mongo (NestJS)
# Dynamic UX MVP API — Current Backend Status

Base URL: `http://localhost:8081`

Authentication: JWT via `Authorization: Bearer <token>`

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
      - `USER_ID=$(curl -s http://localhost:8081/users/me -H "Authorization: Bearer $ACCESS_TOKEN" | jq -r '._id')`
      - `curl -s http://localhost:8081/users/$USER_ID/contract -H "Authorization: Bearer $ACCESS_TOKEN" | jq -r '[ (.json.pagesUI.pages.music.children[] | select(.type=="grid") | .columns), (.json.pagesUI.bottomNavigation.items[0].label) ] | @tsv'`

- Personalized snapshots (authenticated)
  - `GET /contracts/user/:userId` — latest personalized snapshot stored in `UserContract`
  - `POST /contracts/user/:userId` — upsert personalized snapshot (body: `{ contractId?, json }`)

- Contract creation (authenticated)
  - `POST /contracts` — create a contract record (canonical or user-targeted)
  - `POST /users/:id/contract` — create a user-targeted contract in the main `Contract` collection

- LLM generation (authenticated)
  - `POST /llm/generate-contract` — generate an optimized contract from a base and record it under target `userId`
  - `POST /gemini/generate-contract` — same flow via Gemini provider

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

- `POST /auth/login`
  - Logs in and returns JWT.
  - Body: `{ "email": "user@example.com", "password": "secret123" }`
  - Response: `{ "_id": "...", "role": "USER", "username": "user", "name": "User Name", "accessToken": "...", "refreshToken": "..." }`
  - Notes: `username` and `name` are included to allow clients to display user-facing identifiers immediately after login without an extra `/users/me` call.

Notes:
- Uses `LocalAuthGuard` for credential validation.
- JWT is required for most non-auth endpoints; public exceptions are explicitly marked (e.g., `/contracts/canonical`, `/contracts/public/canonical`).

---

## Users

- `GET /users/me` (JWT)
  - Returns the current user profile.

- `GET /users` (JWT)
  - Returns all users.
  - Response DTO: `UserSummaryDto[]`

- `GET /users/:id` (JWT + ADMIN)
  - Returns a user by id.

- `GET /users/:id/contract` (JWT)
  - Returns the latest personalized contract for the user; falls back to the latest canonical contract when none exists.
  - Caching: `Cache-Control: private, max-age=300`; server-side Redis cache key `contracts:user:{id}` when Redis is configured.
  - Response DTO: `ContractDto` (includes `id`, `userId`, `version`, `json`, `createdAt`, `updatedAt`, `meta`).

- `POST /users/:id/contract` (JWT + ADMIN)
  - Creates/updates the user’s latest contract.
  - Request DTO: `UpdateUserContractDto`
  - Response DTO: `ContractDto` (standardized to include `id` and `meta`).
  - Behavior: invalidates `contracts:user:{id}` cache on success.

- `GET /users/:id/tracking-events` (JWT)
  - Lists tracking events for a user; only owner or ADMIN can read.
  - Response DTO: `TrackingEventDto[]`

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

- `GET /events/user/:userId` (JWT)
  - Lists events for a specific user. Only the user or ADMIN may read.
  - Response DTO: `TrackingEventDto[]`

---

## LLM

- `POST /llm/generate-contract` (JWT)
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

- `POST /gemini/generate-contract` (JWT + ADMIN)
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

- `GET /gemini/jobs/:jobId` (JWT)
  - **Process**: Reads job state from the queue store and returns status, progress, timestamps, and result/error when available.
  - **Response** (`GeminiJobStatusDto`):
    ```json
    {
      "id": "gem-8a74b7d0-9f1e-4e37-b7c0-29b1b060c3bb",
      "status": "completed",
      "progress": 100,
      "result": {
        "contractId": "651c0f0a1d6d7e6a4e3b1c6d",
        "version": "1.2.1"
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

- `POST /gemini/circuit-breaker/reset` (JWT + ADMIN)
  - **Process**: Forces the circuit breaker to a closed state, allowing new jobs to enqueue.
  - **Response**:
    ```json
    { "success": true }
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
- 401: Missing/invalid JWT
- 403: Unauthorized action (role or ownership)
- 404: Resource not found

---

## Sessions

- `POST /sessions/start` (JWT)
  - Starts a session for the authenticated user.
  - Request DTO: `CreateSessionDto`
  - Response DTO: `SessionDto`
  - Request may include optional `platform` (e.g., `web`, `ios`, `android`).

- `POST /sessions/:id/end` (JWT)
  - Ends a session; only owner or ADMIN can end.
  - Response DTO: `SessionDto`

- `GET /sessions/user/:userId` (JWT)
  - Lists sessions for a user; only owner or ADMIN.
  - Response DTO: `SessionDto[]`

- `GET /sessions/:id` (JWT)
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