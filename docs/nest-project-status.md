# Project Status and File-by-File Guide

This document captures the current status of the NestJS + MongoDB backend, explains what each file does, how components work together, and notes practical limitations and next steps. It reflects the repository as-is and is intended to help you quickly understand system behavior and where to improve.

## Current State
- Runtime: CORS enabled, global error filter active, Swagger UI available at `http://localhost:8081/api`.
- Port: Uses `ConfigService.get('server.port')` with a fallback to `8081` (server config is loaded; honors `PORT` when set).
- Build & Lint: `npm run lint` and `npm run build` succeed.
- Tests: Unit tests pass (latest run indicated 15 suites / 43 tests; see `docs/test-results.md`). No e2e spec files are present.
- MongoDB: Connected via `database.uri` built from `MONGO_URL` and `MONGO_DATABASE_NAME`.
- Sessions: Session tracking module is reintroduced; events can optionally reference `sessionId` for analytics grouping.
 - Caching: Optional Redis caching via `CacheService` for canonical and user contract reads (TTL 300s; keys `contracts:canonical`, `contracts:user:{id}`); gracefully disabled when Redis is not configured.

## Bootstrapping & Configuration
- `src/main.ts`
  - Creates Nest app, enables CORS, applies `CanonicalErrorFilter`, registers Swagger using bearer auth schemes, applies the global `ValidationPipe` (whitelist/transform), and starts the server.
  - Listens on `configService.get('server.port') || 8081`. Server config is loaded via the `ConfigModule`, so `PORT` is honored when provided; otherwise development defaults to `8081`.

- `src/config/database.config.ts`
  - Provides `database.uri = "${MONGO_URL}/${MONGO_DATABASE_NAME}"` using env vars.

- `src/config/server.config.ts`
  - Declares `server.port` and `rabbitMqBroker` (`RABBITMQ_URL`, `RABBITMQ_TOPIC`). It is loaded into the `ConfigModule` and exposed under the `server` namespace.

- `src/config/index.ts`
  - Exports `[serverConfig, databaseConfig, authConfig, redisConfig, llmConfig, queueConfig]` and is used by `ConfigModule.forRoot({ load: config })`.

Limitations
- RabbitMQ configuration is present but unused; current background processing uses BullMQ over Redis.
- Redis is required for queues; if not configured, queue processors are disabled and related features will be unavailable.
- Ensure provider-specific API keys are set in production; env validation enforces this for the selected `LLM_PROVIDER`.

## Application Module and Bootstrap
- `src/modules/app/app.module.ts`
  - Imports core modules: `UserModule`, `AuthModule`, `ContractModule`, `UserContractModule`, `EventModule`, `SessionModule`, `LlmModule`, `QueueModule`.
  - Sets up `ConfigModule.forRoot({ load: config, validationSchema: Joi.object({...}) })` using `src/config/index.ts`, with Joi validation for server, MongoDB, auth, Redis, LLM provider keys, and queue settings.
  - Configures Mongo connection via `MongooseModule.forRootAsync`, reading `database.uri` from `ConfigService`.
  - Registers Mongoose feature schemas for `User`, `Contract`, `Event`, `UserContract`.

- `src/modules/app/controllers/app.controller.ts`
  - Root controller providing `GET /` (hello) and `GET /ping` health endpoint returning `{ status: 'ok' }`.

- `src/modules/app/services/app.service.ts`
  - Simple service backing the hello endpoint.

- `src/modules/app/services/seed.service.ts`
  - Seeding logic executed on application bootstrap, guarded by `NODE_ENV` and `SEED_ENABLED` env var.
  - Seeds: demo user, a default canonical contract (`1.0.0`), personalized user contract, and sample analytics events.
  - Idempotent: checks for existing data before insertion.

Limitations
- Seeding runs unless disabled or in production; ensure `SEED_ENABLED=false` in production to avoid unintended data.
- Seeded sample data is simplistic and not representative of complex real-world schemas.

## Modules Overview (by file)

### Auth Module — `src/modules/auth`
- `auth.module.ts` — Wires controllers, services, strategies, and guards for authentication.
- Controllers
  - `controllers/auth.controller.ts` —
    - `POST /auth/login` with `LocalAuthGuard` verifies credentials and returns JWT.
    - `POST /auth/signup` (legacy) and `POST /auth/register` create a user via `AuthService.signUp` and return `{ ok: true }`.
  - `controllers/auth.controller.spec.ts` — Unit tests for controller behavior using mocked service.
- Services
  - `services/auth.service.ts` — Validates user credentials via `UserService`, signs JWT using `JwtService`, and handles user registration.
- Strategies
  - `strategies/local.strategy.ts` — Passport local strategy using `email` as the username field.
  - `strategies/jwt.strategy.ts` — Extracts bearer JWT, validates with `JWT_SECRET` (falls back to `'change-me'` if not provided; set the env var).
  - `*.spec.ts` — Tests for strategies.
- Guards
  - `guards/local-auth.guard.ts` — Wraps Passport local auth.
  - `guards/jwt-auth.guard.ts` — Wraps Passport JWT auth.
  - `guards/role-auth.guard.ts` — Reads `@SetMetadata('roles', [])` from handlers and compares to `request.user.role`.
  - `role-auth.guard.spec.ts` — Tests role guard behavior.

Limitations
- No refresh-token or token rotation flow; JWTs rely entirely on `JWT_SECRET` validity.
- `jwt.strategy.ts` defaults `secretOrKey` to `'change-me'`; do not deploy without setting `JWT_SECRET`.
- Registration uses a validated DTO (`CreateUserDto`) with `class-validator` constraints (`email`, `username`, `password` min length 6) and is documented via `ApiBody`.

### User Module — `src/modules/user`
- `user.module.ts` — Registers user controller/service and Mongoose schema.
- Controllers
  - `controllers/user.controller.ts` —
    - `GET /users/me` (JWT) — Current user profile.
    - `GET /users` (JWT) — List all users.
    - `GET /users/:id` (JWT + ADMIN) — Fetch user by id.
    - `GET /users/:id/contract` (JWT) — Latest personalized contract for the user; falls back to canonical when none exists; cached 5 minutes when Redis is configured.
    - `POST /users/:id/contract` (JWT + ADMIN) — Create/update user’s latest contract; returns standardized `ContractDto` including `id` and `meta`; invalidates user contract cache.
    - `GET /users/:id/tracking-events` (JWT) — List user’s events; owner or ADMIN.
    - `PATCH /users/:id` (JWT) — Update user fields.
    - `DELETE /users/:id` (JWT + ADMIN) — Delete user.
  - `controllers/user.controller.spec.ts` — Tests for controller behaviors.
- Services
  - `services/user.service.ts` — User CRUD, credential helpers; hashes passwords with bcrypt.
- DTOs
  - `dto/create-user.dto.ts`, `dto/update-user.dto.ts` — Shapes for creating/updating users.
  - `dto/update-user-contract.dto.ts` — Request mapping for user contract updates.
  - `dto/user-summary.dto.ts`, `dto/user.dto.ts` — Response shapes for listing and detail.
- Entities
  - `entities/user.entity.ts` — User schema: `name`, `username`, `email`, `password`, `passwordHash`, `role`. `toJSON` strips `password` and `passwordHash`.

Limitations
- `findAll` and event listings lack pagination and filtering; large datasets may impact performance.
- Password stored in both `password` and `passwordHash` (only hashed form is required; consider removing the plain `password` field from storage and making validators stricter).

### Contract Module — `src/modules/contract`
 - `contract.module.ts` — Registers controllers/services, schema, and cache provider.
- Controllers
  - `controllers/contract.controller.ts` — `POST /contracts` validates and stores contract; `GET /contracts/:id` returns by id; `GET /contracts/:id/history` (ADMIN) returns chronological history with JSON diffs.
  - `controllers/contract-public.controller.ts` — `GET /contracts/canonical` (Public) returns latest canonical; uses cache.
- Services
  - `services/contract.service.ts` — Validates JSON with `validateContractJson`, enforces semver version, persists contract; supports `findLatest`, `findLatestByUser`, `findLatestCanonical`, `findHistoryByContractId`.
  - `services/contract-validation.service.ts` — Validation support layer (plus `*.spec.ts`).
- Validation
  - `validation/contract-validator.ts` — Detailed contract validator with structure checks and warnings; supported by `validation/contract-validator.spec.ts`.
- DTOs
  - `dto/create-contract.dto.ts`, `dto/contract.dto.ts` — Swagger/DTO shapes for requests/responses.
- Entities
  - `entities/contract.entity.ts` — Schema: `json`, `version` (semver), `meta`, `userId` (optional target), `createdBy`.

Limitations
- Service currently uses `common/validators/contract.validator.ts` wrapper (legacy) rather than the new enhanced validator; unify on the more comprehensive validator for consistency and better error reporting.
- No version conflict checks beyond semver format; consider preventing downgrades and enforcing immutability of historical records.

### User-Contract Module — `src/modules/user-contract`
- `user-contract.module.ts` — Registers controller/service and schema.
- Controllers
  - `controllers/user-contract.controller.ts` — `GET /contracts/user/:userId`; `POST /contracts/user/:userId` upserts personalized contracts.
- Services
  - `services/user-contract.service.ts` — Owner/admin checks; validates JSON; upserts on `(userId, contractId)`.
- DTOs
  - `dto/upsert-user-contract.dto.ts`, `dto/user-personalized-contract.dto.ts` — Request/response shapes.
- Entities
  - `entities/user-contract.entity.ts` — Schema: `userId`, `contractId`, `json`. Unique index on `(userId, contractId)`.

Limitations
- No historical versioning for personalized contracts; last-write wins. Consider explicit versioning and auditing.

### Event Module — `src/modules/event`
- `event.module.ts` — Registers controller/service and schema.
- Controllers
  - `controllers/event.controller.ts` — `POST /events` batch insert; `POST /events/tracking-event` single insert; `GET /events/user/:userId` list user events.
- Services
  - `services/event.service.ts` — `createBatch` maps DTOs to documents, sets `sessionId` if provided, `insertMany`; `listByUser` enforces owner/admin and sorts by `timestamp`; `getLastForUser` returns the latest event time.
- DTOs
  - `dto/create-events.dto.ts` — `EventDto` enforced with class-validator; `CreateEventsBatchDto` for batched payloads.
  - `dto/tracking-event.dto.ts` — Response shape for listing events.
  - `dto/inserted-count.dto.ts` — Response shape for insertion count.
- Entities
  - `entities/event.entity.ts` — Schema: `userId`, optional `sessionId`, `timestamp`, `page`, `componentId`, `eventType` (enum), `data`.

Limitations
- No pagination or query filters exposed for `/events/user/:userId`; consider adding date ranges, types, or session scoping.
- No deduplication or rate limiting for event ingestion; clients could submit excessive events.

### Session Module — `src/modules/session`
- `session.module.ts` — Registers controller/service and schema; imports `EventModule` to fetch events.
- Controllers
  - `controllers/session.controller.ts` — `POST /sessions/start`, `POST /sessions/:id/end`, `GET /sessions/user/:userId`, `GET /sessions/:id` (with events).
- Services
  - `services/session.service.ts` — Start/end sessions, permission-checked listing and detail. `getWithEvents` fetches user events and filters by `sessionId` if present; includes events without `sessionId` for the session user.
- DTOs
  - `dto/create-session.dto.ts` — Requires `contractVersion`; optional `deviceInfo`; optional `platform` for client environment tagging.
  - `dto/session.dto.ts` — Session response shape.
  - `dto/session-with-events.dto.ts` — Session extended with `events: TrackingEventDto[]`.
- Entities
  - `entities/session.entity.ts` — Schema: `userId`, `startedAt`, `endedAt?`, `deviceInfo?`, `platform?`, `contractVersion`.

Limitations
- `getWithEvents` includes events for the user without `sessionId`; this is convenient but may over-report unrelated events. Consider strict filtering to only session-tagged events or adding a time-bound window.
- No session timeout or heartbeat; sessions end only via explicit API call.

### LLM Module — `src/modules/llm`
- `llm.module.ts` — Registers controller/service; imports `ConfigModule`, `ContractModule`, and `EventModule`.
- Controllers
  - `controllers/llm.controller.ts` — `POST /llm/generate-contract` generates an optimized contract using analytics; persists via `ContractService` and returns the created contract DTO.
- Services
  - `services/llm.service.ts` — Computes `eventType` counts and embeds them into contract JSON under `analytics.eventCounts`; bumps patch version (`x.y.z → x.y.(z+1)`), defaults to `0.1.0` when invalid.
- DTOs
  - `dto/generate-contract.dto.ts` — Input `userId`, optional `baseContract`, optional `version`.

Limitations
- The `/llm/generate-contract` endpoint uses a heuristic; provider clients (e.g., Gemini) are integrated and leveraged by the queue processor for background generation. Consider unifying direct generation to use provider clients and capture provenance in `meta`.

## Common Utilities
- `src/common/dto/index.ts`
  - Shared types: `UserDTO`, `ContractDTO`, `TrackingEventDTO` (includes optional `sessionId`). These are type aliases for cross-module consistency.

- Filters
  - `src/common/filters/canonical-error.filter.ts` — Global exception filter mapping exceptions to a standardized JSON envelope (`error.code`, `error.message`, `error.details`, `requestId`).
  - `src/common/filters/canonical-error.filter.spec.ts` — Tests to confirm error formatting for `HttpException` and generic `Error`.

- Validation Helpers
  - `src/common/validation/enhanced-validator.ts` — Configurable field-level and cross-field validation helper (`required`, `email`, `minLength`, `pattern`, and an `equal` cross-field rule). Useful for UI form validation or contract validation steps.
  - `src/common/validation/validation-result.ts` — Types for `ValidationResult`, `ValidationError`, `ValidationWarning`, `SimpleValidationResult`, and utility `makeEmptyStats`.

- Validators (Legacy Wrapper)
  - `src/common/validators/contract.validator.ts` — Legacy validator wrapper used by `ContractService` and `UserContractService` (`validateContractJson`).
  - `src/common/validators/contract.validator.spec.ts` — Tests for validator wrapper.

Limitations
- EnhancedValidator is not currently wired into controllers/services; contract validation relies on the legacy wrapper. Consider converging on a single validation engine.

## Documentation
- `docs/api.md` — Endpoint reference with methods, access controls, request/response DTOs.
- `docs/modules.md` — Module-by-module overview, including Sessions reintroduction.
- `docs/setup.md` — Environment variables, prerequisites, and seeding behavior.
- `docs/contract-validation.md` — Deep dive on contract validation rules and files.
- `docs/test-results.md` — Summarizes test coverage and notable behaviors.

## Build, Tooling, and Tests
- `package.json`
  - Scripts: `start`, `start:dev`, `build`, `lint`, `test`, `test:e2e`, `test:cov`.
  - Dependencies: NestJS, Mongoose, JWT, Passport, Swagger, bcrypt, testing/runtime packages.
- `tsconfig.json` / `tsconfig.build.json`
  - TypeScript compilation settings; build excludes `**/*spec.ts`.
- `.eslintrc.js` / `.prettierrc`
  - Code style and formatting rules; Prettier integration enforced by ESLint.
- `nest-cli.json`
  - Schematics and `sourceRoot` set to `src`.
- Jest configuration in `package.json` and `test/jest-e2e.json`.
  - Unit tests run from `src/**/*.(t|j)s` with `rootDir: src`.
  - E2E config exists but there are no `.e2e-spec.ts` files currently.

Limitations
- No e2e tests in the repository; add at least a smoke suite covering auth, contracts, events, and sessions.
- CI/CD not described in the repo; consider adding GitHub Actions with lint, build, unit tests, and e2e.
- No request throttling/rate limiting configured; consider protecting ingestion endpoints.

## Known Gaps and Next Steps
- Replace the legacy contract validator with the enhanced validator where appropriate; provide strict DTO validation for contract payloads.
- Add pagination and filtering for event and user lists.
- Introduce session heartbeat/timeout and stricter event-to-session binding.
- Strengthen auth flows: refresh tokens, password policies, and brute-force protection.
- Add e2e tests and a CI pipeline.
 - Caching: Add canonical cache invalidation on new contract creation and configurable TTL per environment.

## Appendix: Entities and Relationships
- `User` — core identity; referenced by `Contract.createdBy`, `Contract.userId`, `Event.userId`, and `Session.userId`.
- `Contract` — canonical UI contract; optionally associated with a `userId` when personalized; recorded with `createdBy`.
- `UserContract` — personalized contract keyed by `(userId, contractId)`; stores `json` snapshot.
- `Event` — analytics events with optional `sessionId` linking to `Session`.
- `Session` — session lifecycle record with `contractVersion` and optional `deviceInfo`.

This file is generated to reflect the repository’s current state. If you add or modify modules or files, update this document to keep status accurate.