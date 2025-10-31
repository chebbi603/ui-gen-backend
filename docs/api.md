# Dynamic UX MVP API — Current Backend Status

Base URL: `http://localhost:8081`

Authentication: JWT via `Authorization: Bearer <token>`

Swagger: `http://localhost:8081/api`

---

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
  - Response: `{ "_id": "...", "role": "USER", "accessToken": "..." }`

Notes:
- Uses `LocalAuthGuard` for credential validation.
- JWT is required for all non-auth endpoints.

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
  - Request DTO: `CreateEventsBatchDto`
  - Response DTO: `InsertedCountDto`

- `POST /events/tracking-event` (JWT)
  - Inserts a single tracking event for the current JWT user.
  - Request DTO: `EventDto`
  - Response DTO: `InsertedCountDto`

- `GET /events/user/:userId` (JWT)
  - Lists events for a specific user. Only the user or ADMIN may read.
  - Response DTO: `TrackingEventDto[]`

---

## LLM

- `POST /llm/generate-contract` (JWT)
  - Generates and persists an optimized contract using user analytics and optional base contract.
  - Request DTO: `GenerateContractRequestDto`
  - Response DTO: `ContractDto` (standardized including `id` and `meta`).

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