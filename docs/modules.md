# Modules Overview

This document summarizes each NestJS module in the backend, its responsibilities, exposed routes, and main components.

Base URL: `http://localhost:8081`
Swagger: `http://localhost:8081/api`

---

## App Module

- Purpose: Root application module; bootstraps configuration, database, global filters, and seeds initial data.
- Controllers:
  - `AppController`
    - `GET /` → returns a simple hello message.
    - `GET /ping` → health check returning `{ "status": "ok" }`.
- Services:
  - `AppService` — trivial helper.
  - `SeedService` — seeding initial data/contracts.
- Integrations:
  - Imports: `UserModule`, `AuthModule`, `ContractModule`, `UserContractModule`, `EventModule`, `LlmModule`, `MongooseModule`, `ConfigModule`.
  - Global error filter: Canonical error envelope (`error.code`, `error.message`, `error.details`, `requestId`).

---

## Auth Module

- Purpose: Authentication and user registration.
- Controllers:
  - `AuthController`
    - `POST /auth/login` — guarded by `LocalAuthGuard`; returns `{ _id, role, accessToken }`.
    - `POST /auth/register` — registers a new user; returns `{ ok: true }`.
    - `POST /auth/signup` — legacy alias; returns `{ ok: true }`.
- Services:
  - `AuthService`
    - Validates user credentials via `UserService` and `bcrypt`.
    - Issues JWT via `JwtService`.
- Guards/Strategies:
  - `LocalAuthGuard` (login credentials).
  - `JwtAuthGuard` (protects non-auth endpoints via Bearer token).
  - `RoleGuard` (ADMIN-only routes in User module).
- Notes: All non-auth endpoints require `Authorization: Bearer <token>`.

---

## User Module

- Purpose: User profile and admin operations.
- Controllers:
  - `UserController`
    - `GET /users/me` (JWT) — current user profile.
    - `GET /users` (JWT) — list all users.
    - `GET /users/:id` (JWT + ADMIN) — fetch user by id.
    - `GET /users/:id/contract` (JWT) — latest canonical contract bound to the user.
    - `POST /users/:id/contract` (JWT + ADMIN) — create/update user’s latest contract.
    - `PATCH /users/:id` (JWT) — update user fields.
    - `DELETE /users/:id` (JWT + ADMIN) — delete a user.
- Services:
  - `UserService` — CRUD and search helpers.
- Guards:
  - `JwtAuthGuard` and `RoleGuard` for protected routes.

---

## Contract Module

- Purpose: Store and retrieve canonical contracts.
- Controllers:
  - `ContractController` (JWT)
    - `POST /contracts` — stores a validated canonical contract.
      - Request DTO: `CreateContractDto`
      - Response DTO: `ContractDto`
    - `GET /contracts/:id` — retrieve contract by id.
      - Response DTO: `ContractDto`
- Services:
  - `ContractService` — validation and persistence logic.
- DTOs:
  - `CreateContractDto`, `ContractDto`
- Entities:
  - `Contract` — Mongoose schema.
- Notes: Contract JSON validation is enforced before persistence.

---

## User-Contract Module

- Purpose: Manage user-personalized contracts.
- Controllers:
  - `UserContractController` (JWT)
    - `GET /contracts/user/:userId` — get a user’s personalized contract.
      - Response DTO: `UserPersonalizedContractDto`
    - `POST /contracts/user/:userId` — upsert personalized contract.
      - Request DTO: `UpsertUserContractDto`
      - Response DTO: `UserPersonalizedContractDto`
      - Only the user or ADMIN may write.
- Services:
  - `UserContractService` — upsert/retrieval logic with role/ownership checks.
- DTOs:
  - `UpsertUserContractDto`, `UserPersonalizedContractDto`
- Entities:
  - `UserContract` — Mongoose schema linking `userId` to contract JSON.

---

## Event Module

- Purpose: Event/analytics ingestion and listing per user.
- Controllers:
  - `EventController` (JWT)
    - `POST /events` — ingest event batch for authenticated user.
      - Request DTO: `CreateEventsBatchDto`
      - Response DTO: `InsertedCountDto`.
    - `POST /events/tracking-event` — ingest a single tracking event for authenticated user.
      - Request DTO: `EventDto`
      - Response DTO: `InsertedCountDto`.
    - `GET /events/user/:userId` — list events by user; requires ownership or ADMIN.
      - Response DTO: `TrackingEventDto[]`
- Services:
  - `EventService` — batch create and query by user.
- DTOs:
  - `CreateEventsBatchDto`, `EventDto`, `InsertedCountDto`, `TrackingEventDto`
- Entities:
  - `Event` — Mongoose schema.

---

## LLM Module

- Purpose: Generate optimized contracts leveraging event analytics.
- Controllers:
  - `LlmController` (JWT)
    - `POST /llm/generate-contract` — generates and persists an optimized contract.
      - Request DTO: `GenerateContractRequestDto`
      - Response DTO: `ContractDto`
- Services:
  - `LlmService` — synthesizes optimized contract using `EventService` and `ContractService`.
- Dependencies:
  - Imports `ContractModule` and `EventModule`.

---

## Session Module

- Purpose: Track user sessions for behavioral analytics, pain point detection, and personalization.
- Controllers:
  - `SessionController` (JWT)
    - `POST /sessions/start` — start a session for the authenticated user.
    - `POST /sessions/:id/end` — end a session; owner or ADMIN only.
    - `GET /sessions/user/:userId` — list sessions for a user; owner or ADMIN.
    - `GET /sessions/:id` — fetch a session with its events; owner or ADMIN.
- Services:
  - `SessionService` — start/end sessions, list and fetch with permission checks.
- DTOs:
  - `CreateSessionDto`, `SessionDto`, `SessionWithEventsDto`
- Entities:
  - `Session` — Mongoose schema with `userId`, `startedAt`, `endedAt`, `deviceInfo`, `contractVersion`, optional `platform`.
- Contents:
  - `SessionModule` — registers `{ name: Session.name, schema: SessionSchema }` and exports `MongooseModule`.
  - `entities/session.entity.ts` — the schema definition.
- Notes: DTOs and endpoints include optional `platform` for analytics segmentation (e.g., `web`, `ios`, `android`).

---

## Queue Module

- Purpose: Background processing for contract generation and related jobs.
- Providers:
  - `QueueService` — initializes BullMQ queues and workers; manages job cleanup.
  - `GeminiGenerationProcessor` — processes gemini-generation jobs using `LlmService` and persists via `ContractService`.
- Imports:
  - `ConfigModule`, `LlmModule`, `ContractModule`.
- Configuration:
  - Controlled via `QUEUE_*` env vars (attempts, backoff, timeout, cleanup windows, test job).

---

## Common Utilities

- Filters:
  - `CanonicalErrorFilter` — global exception filter returning standardized error envelope.
- Validators:
  - `contract.validator.ts` — defines `ContractValidationResult` and supports contract validation routines.

---

## Configuration

- Config (`src/config`):
  - `server.config.ts` — exposes `server.port` and RabbitMQ broker keys.
  - `database.config.ts` — MongoDB URI and options.
  - `auth.config.ts`, `redis.config.ts`, `llm.config.ts`, `queue.config.ts` — provider-specific configs.
  - `index.ts` — loads all configs via `@nestjs/config`.
- Bootstrap (`src/main.ts`):
  - Enables CORS, Swagger, global error filter, global `ValidationPipe` (whitelist/forbidNonWhitelisted/transform).
  - Listens on `server.port` (from `server.config.ts`) with fallback to `8081`.

---

## Notes

- Focus areas: Auth, Users, Canonical Contracts, User-Personalized Contracts, and Events.
- Posts endpoints were removed to align with event collection and contract delivery goals.
- See `docs/api.md` for endpoint details and payload examples.