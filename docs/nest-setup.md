Project: nestjs-mongo (NestJS)
# Setup & Environment

## Prerequisites
- Node 18+
- MongoDB (local or cloud)

## Environment Variables
Copy `.env.example` to `.env` and set:

- `PORT=8081` (optional; defaults from server config)
- `MONGO_URL` (e.g., `mongodb://localhost:27017`)
- `MONGO_DATABASE_NAME` (e.g., `blog`)
- `JWT_SECRET` (required in production; strong random string)
- `SEED_ENABLED=true` (optional; enables dev seeding)
 - `SEED_SAMPLE_EVENTS=true` (optional; enables seeding of a couple of sample analytics events; disabled by default)

Optional:
- `RABBITMQ_URL`, `RABBITMQ_TOPIC`
- `JWT_EXPIRES_IN` (e.g., `1h`, `7d`)
- `REDIS_URL` or (`REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB`)
- `LLM_PROVIDER` (`openai`, `anthropic`, or `gemini`)
- `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL`
- `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `ANTHROPIC_BASE_URL`
 - `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_BASE_URL`
 - Queue (BullMQ) options for background generation:
   - `QUEUE_GEMINI_ATTEMPTS`, `QUEUE_GEMINI_BACKOFF_MS`, `QUEUE_GEMINI_TIMEOUT_MS`
   - `QUEUE_CLEANUP_COMPLETED_MS`, `QUEUE_CLEANUP_FAILED_MS`
   - `QUEUE_ADD_TEST_JOB` (`true` to enqueue a sample job at startup in development)

Redis & Caching:
- Redis is optional; when configured, read endpoints leverage a lightweight cache (`CacheService`) to reduce DB load.
- Canonical and user contract endpoints set `Cache-Control` headers and use Redis keys `contracts:canonical` and `contracts:user:{id}`.
- TTL defaults to 300 seconds for common reads; LLM analytics are cached under `llm:analytics:{userId}` with TTL 300 seconds.

## MongoDB Modes: Memory vs Persistent (important)
- The server can auto-start an in-memory MongoDB for convenience.
- Triggered when `USE_MEMORY_MONGO=true` or `MONGO_URL` is missing/points to a memory URI.
- In-memory mode is ephemeral; data (including analytics events) does not persist.

### Use a Persistent Database
Set the following in `.env` to ensure data is saved:
```
USE_MEMORY_MONGO=false
MONGO_URL=mongodb://localhost:27017
MONGO_DATABASE_NAME=ui_customisation
```
- If your `MONGO_URL` already includes a path (database name), `MONGO_DATABASE_NAME` is optional.
- Example combined URL: `MONGO_URL=mongodb://localhost:27017/ui_customisation`.

### Detecting Memory Mode
- Startup logs show: `[MemoryMongo] In-memory MongoDB started at mongodb://127.0.0.1:<port>/...` when memory mode is active.
- If you see this and expect persistence, set `USE_MEMORY_MONGO=false` and provide a real `MONGO_URL`.

### Why Events Seem Missing
- When running in memory mode, collections vanish on server stop; local folders may appear empty.
- To persist analytics events, always run with a real MongoDB URL as shown above.
- Caching gracefully disables when Redis is unavailable; `CacheService` logs warnings and falls back to direct reads.
- Redis config values are provided via `redis.*` config keys, populated from env: `REDIS_URL` or host/port/password/db.

Startup validation:
- The app validates env vars on boot (Joi schema) and fails fast with clear messages when required values are missing, including provider API keys for the selected `LLM_PROVIDER` and queue options.
- In development, a strong random JWT secret is generated if `JWT_SECRET` is absent.
- In production, missing required vars (e.g., `JWT_SECRET`, provider API keys) prevent startup.

## Running

- Install: `npm install`
- Start dev: `npm run start`
- Swagger: `http://localhost:8081/api`

### Public Canonical Endpoints

- `GET /contracts/canonical` — latest canonical contract (no authentication required).
- `GET /contracts/public/canonical` — public alias; identical response and caching; useful when environments have route guard collisions.

## Seeding

When `SEED_ENABLED=true`, the app seeds:
- Demo user
- Default app contract
- Personalized user contract for demo user
- Sample events (view/tap)

Seeding is idempotent and skips in production.

### Contracts from Disk (Development)
- Canonical and personalized contracts can be loaded from disk during seeding:
  - Canonical: `src/modules/app/data/canonical-contract-v1.json`
  - Personalized: `src/modules/app/data/personalized-contract-example.json`
- On startup, seeding updates the database and invalidates caches (`contracts:canonical`, `contracts:user:{id}`) so endpoints serve the latest content.
- Edit these files and restart (`npm run start`) to iterate on contract definitions in development.
- In production, set `SEED_ENABLED=false` and manage contracts via admin or LLM endpoints.

## CORS

CORS is enabled globally. To restrict origins, update server bootstrap to pass options to `enableCors`.

## Authentication

- Login with `/auth/login` to obtain a JWT.
- Send JWT in `Authorization: Bearer <token>` for protected endpoints.

## Roles & Access

- Admin-only routes use role guard (e.g., `/users/:id`, user deletion, and selected contract mutation endpoints). `/users` requires JWT but not ADMIN.
- MVP change: Event ingestion endpoints are PUBLIC (no JWT required). Listing user events is also PUBLIC in this refactor.

## Contract JSON Requirements

- `json.screens` is a non-empty array.
- Each screen requires `id` and `components` array.
- Each component requires `id` and `type`.
- `version` must follow semver (e.g., `1.0.0`).

## Troubleshooting

- 400: Check DTO and contract JSON shape.
- 401: Ensure valid JWT in `Authorization` header.
- 403: Verify you’re accessing own resources or have ADMIN role.
- 404: Verify resource IDs.

## Useful URLs

- API docs: `/api` (Swagger UI)
 - Endpoint reference: `docs/nest-api.md`

## Testing

- Unit: `npm run test`
- E2E: `npm run test:e2e`
  - Uses `test/jest-e2e.json` and mocks `jsonwebtoken`/`ioredis` for stability.

## Mongo Persistence vs Memory Mode

- Purpose: Ensure analytics events persist to your real MongoDB and avoid ephemeral in-memory fallback.
- Behavior:
  - The server can auto-start an in-memory MongoDB if `USE_MEMORY_MONGO=true` or if `MONGO_URL` is missing/invalid at bootstrap.
  - `.env` is now loaded early via `dotenv/config` in `src/main.ts`, so values from `.env` are respected before the memory check.
- Recommended `.env` (no shell vars needed):
  - `USE_MEMORY_MONGO=false`
  - `MONGO_URL=mongodb://127.0.0.1:27017`
  - `MONGO_DATABASE_NAME=thesis`
- Verification steps:
  - Start dev: `npm run start:dev`
  - Confirm logs do not include `[MemoryMongo] In-memory MongoDB started ...`.
  - Insert sample: `curl -s -X POST http://localhost:8081/events -H 'Content-Type: application/json' -d '{"events":[{"eventType":"tap","userId":"000000000000000000000000","timestamp":1730000000000,"data":{}}]}'`.
  - Read back: `curl -s http://localhost:8081/events/aggregate`.