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
  - Imports: `UserModule`, `AuthModule`, `ContractModule`, `UserContractModule`, `EventModule`, `SessionModule`, `MongooseModule`, `ConfigModule`.
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
    - `GET /users` (JWT + ADMIN) — list all users.
    - `GET /users/:id` (JWT + ADMIN) — fetch user by id.
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
      - Body: `{ version: "1.0.0", json: { /* canonical contract */ }, meta?: { /* metadata */ } }`
    - `GET /contracts/:id` — retrieve contract by id.
- Services:
  - `ContractService` — validation and persistence logic.
- Entities:
  - `Contract` — Mongoose schema.
- Notes: Contract JSON validation is enforced before persistence.

---

## User-Contract Module

- Purpose: Manage user-personalized contracts.
- Controllers:
  - `UserContractController` (JWT)
    - `GET /contracts/user/:userId` — get a user’s personalized contract.
    - `POST /contracts/user/:userId` — upsert personalized contract.
      - Only the user or ADMIN may write.
- Services:
  - `UserContractService` — upsert/retrieval logic with role/ownership checks.
- Entities:
  - `UserContract` — Mongoose schema linking `userId` to contract JSON.

---

## Event Module

- Purpose: Event/analytics ingestion and listing per user.
- Controllers:
  - `EventController` (JWT)
    - `POST /events` — ingest event batch for authenticated user.
      - Body: `{ events: [{ timestamp, componentId, eventType, data? }, ...] }`
      - Response: `{ inserted: <count> }`.
    - `GET /events/user/:userId` — list events by user; requires ownership or ADMIN.
- Services:
  - `EventService` — batch create and query by user.
- DTOs:
  - `CreateEventsBatchDto` — validates `{ events: [...] }` payload.
- Entities:
  - `Event` — Mongoose schema.

---

## Session Module

- Purpose: Provide Mongoose integration for `Session` entity (e.g., refresh tokens or server-side sessions if used).
- Contents:
  - `SessionModule` — registers `{ name: Session.name, schema: SessionSchema }` and exports `MongooseModule`.
  - `entities/session.entity.ts` — the schema definition.
- Notes: No controllers; acts as a persistence module for session-related features.

---

## Common Utilities

- Filters:
  - `CanonicalErrorFilter` — global exception filter returning standardized error envelope.
- Validators:
  - `contract.validator.ts` — defines `ContractValidationResult` and supports contract validation routines.

---

## Configuration

- Config (`src/config`):
  - `server.config.ts` — `PORT`, RabbitMQ broker configuration placeholders.
  - `database.config.ts` — MongoDB URI and options.
  - `index.ts` — loads config via `@nestjs/config`.
- Bootstrap (`src/main.ts`):
  - Enables CORS, Swagger, global error filter, and listens on `PORT` or `8081`.

---

## Notes

- Focus areas: Auth, Users, Canonical Contracts, User-Personalized Contracts, and Events.
- Posts endpoints were removed to align with event collection and contract delivery goals.
- See `docs/api.md` for endpoint details and payload examples.