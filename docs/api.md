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

- `GET /users` (JWT + ADMIN)
  - Returns all users.

- `GET /users/:id` (JWT + ADMIN)
  - Returns a user by id.

- `PATCH /users/:id` (JWT)
  - Updates fields of a user.

- `DELETE /users/:id` (JWT + ADMIN)
  - Deletes a user.

---

## Canonical Contracts

- `POST /contracts` (JWT)
  - Stores a canonical contract after validation.
  - Body:
    ```json
    {
      "version": "1.0.0",
      "json": { /* full canonical contract JSON */ },
      "meta": { "name": "Default App Contract" }
    }
    ```
  - Response: Contract document JSON.

- `GET /contracts/:id` (JWT)
  - Returns a contract by id.

---

## User-Personalized Contracts

- `GET /contracts/user/:userId` (JWT)
  - Returns the personalized contract for a user.
  - Response: `{ "json": { /* contract JSON */ } }`

- `POST /contracts/user/:userId` (JWT)
  - Upserts a personalized contract. Only the user or ADMIN may write.
  - Body:
    ```json
    {
      "contractId": "<optional id>",
      "json": { /* full canonical contract JSON */ }
    }
    ```

---

## Events (Analytics)

- `POST /events` (JWT)
  - Inserts a batch of events attributed to the current JWT user.
  - Body:
    ```json
    {
      "events": [
        { "timestamp": "2025-10-26T00:00:00.000Z", "componentId": "home", "eventType": "view", "data": { "page": "home" } }
      ]
    }
    ```
  - Response: `{ "inserted": <count> }`

- `GET /events/user/:userId` (JWT)
  - Lists events for a specific user. Only the user or ADMIN may read.

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

## Notes

- Posts module/endpoints have been removed; the backend focuses on auth, users, canonical contracts, and event collection.
- See Swagger at `/api` for complete schemas.