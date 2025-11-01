## Description

Dynamic UX MVP API built with NestJS and MongoDB.

- API reference: `docs/nest-api.md`
- Modules overview: `docs/nest-modules.md`
- Setup guide: `docs/nest-setup.md`
- Contracts behavior: `docs/contracts-behavior.md`
- Swagger UI: visit `http://localhost:8081/api` when the server is running.

## Recent Changes

- Standardized Swagger with DTOs across Users, Events, LLM, Contracts.
- Reintroduced `SessionModule` (keep sessions) for analytics and personalization.
- Added sessions endpoints: `POST /sessions/start`, `POST /sessions/:id/end`, `GET /sessions/user/:userId`, `GET /sessions/:id`.
- Events now accept optional `sessionId` and return it in responses.
- Added `QueueModule` (BullMQ) for background contract generation; configurable via `QUEUE_*` env vars.
- LLM configuration now supports `openai`, `anthropic`, and `gemini` providers.
- Global validation enabled via `ValidationPipe` (whitelist, forbid non-whitelisted, transform).
- Server port comes from `server.port` (loaded from `server.config.ts`) with fallback to `8081`.
- Cleaned unused imports and parameters; lints now pass cleanly.
- Synced docs (`api.md`, `modules.md`) to reference request/response DTOs.

- Added public canonical alias endpoint: `GET /contracts/public/canonical` (identical to `/contracts/canonical`), provided to avoid dynamic route collisions.
- Added E2E tests verifying public canonical endpoints and protected contract routes; e2e config (`test/jest-e2e.json`) maps `jsonwebtoken` and `ioredis` to local mocks for stable runs.

## Installation

```bash
$ npm install
```

## Running the app

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Test

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```
