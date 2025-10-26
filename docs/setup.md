# Setup & Environment

## Prerequisites
- Node 18+
- MongoDB (local or cloud)

## Environment Variables
Copy `.env.example` to `.env` and set:

- `PORT=8081` (optional; defaults from server config)
- `MONGO_URL` (e.g., `mongodb://localhost:27017`)
- `MONGO_DATABASE_NAME` (e.g., `blog`)
- `JWT_SECRET` (required; strong random string)
- `SEED_ENABLED=true` (optional; enables dev seeding)

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

- Admin-only routes use role guard (e.g., `/users`, `/users/:id`).
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