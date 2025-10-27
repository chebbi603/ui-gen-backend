## Description

Dynamic UX MVP API built with NestJS and MongoDB.

- API reference: `docs/api.md`
- Modules overview: `docs/modules.md`
- Setup guide: `docs/setup.md`
- Swagger UI: visit `http://localhost:8081/api` when the server is running.

## Recent Changes

- Standardized Swagger with DTOs across Users, Events, LLM, Contracts.
- Reintroduced `SessionModule` (keep sessions) for analytics and personalization.
- Added sessions endpoints: `POST /sessions/start`, `POST /sessions/:id/end`, `GET /sessions/user/:userId`, `GET /sessions/:id`.
- Events now accept optional `sessionId` and return it in responses.
- Cleaned unused imports and parameters; lints now pass cleanly.
- Synced docs (`api.md`, `modules.md`) to reference request/response DTOs.

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
