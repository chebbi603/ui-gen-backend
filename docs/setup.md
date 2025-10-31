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

Startup validation:
- The app validates env vars on boot (Joi schema) and fails fast with clear messages when required values are missing, including provider API keys for the selected `LLM_PROVIDER` and queue options.
- In development, a strong random JWT secret is generated if `JWT_SECRET` is absent.
- In production, missing required vars (e.g., `JWT_SECRET`, provider API keys) prevent startup.

## Running

- Install: `npm install`
- Start dev: `npm run start`
- Swagger: `http://localhost:8081/api`

## Seeding

When `SEED_ENABLED=true`, the app seeds:
- Demo user
- Default app contract
- Personalized user contract for demo user
- Sample events (view/tap)

Seeding is idempotent and skips in production.

## CORS

CORS is enabled globally. To restrict origins, update server bootstrap to pass options to `enableCors`.

## Authentication

- Login with `/auth/login` to obtain a JWT.
- Send JWT in `Authorization: Bearer <token>` for protected endpoints.

## Roles & Access

- Admin-only routes use role guard (e.g., `/users/:id`, user deletion, and selected contract mutation endpoints). `/users` requires JWT but not ADMIN.
- Event and user-contract endpoints enforce ownership or ADMIN role.

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
- Endpoint reference: `docs/api.md`