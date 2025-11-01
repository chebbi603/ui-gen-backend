Project: nestjs-mongo (NestJS)
# Jest Test Results

## Latest Run Summary
- Command: `npm test --silent`
- Test Suites: 19 passed, 19 total
- Tests: 61 passed, 61 total
- Snapshots: 0 total
- Time: ~5.0 s

## Test Suites and What They Test

- `src/modules/auth/services/auth.service.spec.ts`
  - `validateUser` matches passwords, sanitizes user (no password), returns `null` on mismatch.
  - `login` returns `accessToken`, `refreshToken`, and user role.
  - `signUp` delegates creation to `UserService.create`.

- `src/modules/user/services/user.service.spec.ts`
  - `create` hashes the password, assigns default role, throws `ConflictException` if email exists.
  - `findAll` returns users via `find().exec()` and resolves to an array.
  - `findOne` fetches by id via `findById().exec()`; handles not found.
  - `update` restricts fields, uses `findById` then `save`; handles `NotFoundException`.
  - `remove` deletes by id via `findByIdAndDelete().exec()`.

- `src/modules/auth/guards/role-auth.guard.spec.ts`
  - Allows when no `roles` metadata.
  - Denies on role mismatch; allows when roles match.

- `src/common/filters/canonical-error.filter.spec.ts`
  - Maps `HttpException` status to canonical code (e.g., `NOT_FOUND` for 404), including when response is a string.
  - Formats generic `Error` with 500 status and includes stack details.

- `src/modules/auth/strategies/local.strategy.spec.ts`
  - Validates credentials using `AuthService.validateUser`.

- `src/modules/auth/strategies/jwt.strategy.spec.ts`
  - Validates JWT payload and returns sanitized user.

- `src/modules/auth/controllers/auth.controller.spec.ts`
  - Mocks `AuthService`; verifies `login` and `signUp` forward to service and return expected shapes.

- `src/modules/user/controllers/user.controller.spec.ts`
  - Mocks `UserService`; verifies `findAll`, `findOne`, `update`, `remove` call service and return expected results.

- `src/modules/event/services/event.service.spec.ts`
  - `listByUser` filters events using valid ObjectId inputs for owner/admin and target user.
  - `createBatch` handles batch creation with expected results.

- `src/modules/contract/services/contract.service.spec.ts`
  - Verifies contract CRUD with mocked model methods.

- `src/modules/contract/services/contract-validation.service.spec.ts`
  - Validates contract JSON/version; maps errors to `BadRequestException`.

- `src/modules/user-contract/services/user-contract.service.spec.ts`
  - `upsertUserContract` inserts/updates by `userId`.
  - `getUserContract` fetches by id using valid ObjectId strings.

- `src/modules/app/controllers/app.controller.spec.ts`
  - Adds a simple ping/health check test confirming controller responds.

- `src/modules/queue/queue.service.spec.ts`
  - Mocks queue operations; verifies job add/fetch/status mapping without Redis.
  - Handles initialization errors and retry-path behavior.

- `src/modules/queue/controllers/gemini.controller.spec.ts`
  - Ensures controller endpoints delegate to queue service and return expected shapes.

- `src/modules/queue/processors/gemini-generation.processor.spec.ts`
  - Covers success path, retryable failures, non-retryable failures, and validation failure post-LLM.
  - Injects `ContractValidationService` mock; asserts discard and error logging on validation errors.
  - Uses a valid `ObjectId` for `userId` to avoid `BSONTypeError`.

- `src/modules/llm/services/gemini.service.spec.ts`
  - Circuit breaker opens after threshold, resets, and auto-resets after cooldown.

## Notable Behaviors
- You may see a console log during `UserService.create` conflict scenario:
  - `ConflictException: email already exists` — this is expected and verifies conflict handling.
- Unit tests stub `@nestjs/jwt` and `passport-jwt` to avoid loading `jsonwebtoken`/`jwa` in Node/Jest.
- Authentication tests mock `ConfigService` keys (`auth.jwt.refreshSecret`, `auth.jwt.refreshExpiresIn`).
- Some runs may display `Warning: --localstorage-file was provided without a valid path` — benign for tests.
 

## E2E Test Summary (Latest Run)

- Command: `npm run test:e2e`
- Suites: All e2e suites passed.
- Coverage: Smoke coverage verifies public canonical endpoints and protected contract access.
- What’s covered:
  - `GET /contracts/canonical` returns `200` without authentication.
  - `GET /contracts/public/canonical` returns `200` (alias route).
  - `GET /contracts/:id` returns `401` when unauthenticated.
- Environment notes:
  - E2E Jest config maps `jsonwebtoken` to a local mock and stubs Redis (`ioredis`) to prevent import-time errors and external dependencies.

## Redis Cache Verification (2025-11-01)

- Baseline unit tests: `npm test --silent` — 61 passed.
- Caching headers validated via e2e on canonical routes:
  - `GET /contracts/canonical` → `Cache-Control: public, max-age=300`
  - `GET /contracts/public/canonical` → same header; identical body to canonical.
- Runtime commands for manual verification (no `.env` changes):
  - Start with Redis: ``REDIS_URL=redis://127.0.0.1:6379 npm run start:dev``
  - Latency check: first vs. second call
    - ``curl -s -o /dev/null -w "HTTP=%{http_code} time=%{time_total}\n" http://localhost:8081/contracts/canonical``
    - Second call expected faster (cache hit).
  - Header check:
    - ``curl -I http://localhost:8081/contracts/canonical | grep -i cache-control``
    - ``curl -I http://localhost:8081/contracts/public/canonical | grep -i cache-control``
- Graceful degradation:
  - Start with invalid Redis URL: ``REDIS_URL=redis://127.0.0.1:6390 npm run start:dev``
  - Requests should still be `HTTP=200` without cache benefits; warnings logged.
- See `docs/nest-redis-cache-verification.md` for detailed steps and success metrics.

## Response Compression (2025-11-01)

- Middleware: `compression` registered in `src/main.ts` with `level: 6`, `threshold: 1024`.
- Header checks:
  - Identity: `curl -s -D - -H 'Accept-Encoding: identity' http://localhost:8081/contracts/canonical -o /dev/null | grep -iE 'content-length|content-encoding'`
    - Observed: `Content-Length: 2248`
  - Gzip: `curl -s -D - -H 'Accept-Encoding: gzip' http://localhost:8081/contracts/canonical -o /dev/null | grep -iE 'content-length|content-encoding'`
    - Observed: `Content-Encoding: gzip`
- Size comparison:
  - Identity body bytes: `2248`
  - Gzip body bytes: `910` (~59.5% reduction)
- Compatibility: Browser, Postman, and curl handle gzip correctly.
- Tests: `npm test --silent` — 19 suites, 61 tests passed after change.

## Full Output (Latest Run)
```
## Latest Run Summary (Index Update - 2025-11-01)
- Command: `npm test --silent`
- Test Suites: 19 passed, 19 total
- Tests: 61 passed, 61 total
- Snapshots: 0 total
- Time: ~8.4 s

### Notes
- Added schema indexes to `User`, `Event`, and `Contract` entities.
- No test regressions; processor validation behavior remains intact.
- See `docs/nest-db-indexes.md` for details and verification steps.
```
> jest

PASS  src/modules/auth/services/auth.service.spec.ts
PASS  src/modules/user/services/user.service.spec.ts
PASS  src/modules/queue/queue.service.spec.ts
PASS  src/modules/queue/controllers/gemini.controller.spec.ts
PASS  src/modules/auth/strategies/local.strategy.spec.ts
PASS  src/modules/auth/strategies/jwt.strategy.spec.ts
PASS  src/modules/user/controllers/user.controller.spec.ts
PASS  src/modules/contract/services/contract.service.spec.ts
PASS  src/modules/contract/services/contract-validation.service.spec.ts
PASS  src/modules/event/services/event.service.spec.ts
PASS  src/modules/user-contract/services/user-contract.service.spec.ts
PASS  src/modules/app/controllers/app.controller.spec.ts
... (remaining suites passed)

Test Suites: 19 passed, 19 total
Tests:       61 passed, 61 total
Snapshots:   0 total
Time:        ~5.0 s
```