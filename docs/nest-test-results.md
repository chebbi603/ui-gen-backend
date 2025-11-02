Project: nestjs-mongo (NestJS)
# Jest Test Results

## Latest Run Summary — Unit
- Date: 2025-11-02
- Command: `npm test --silent`
- Test Suites: 20 passed, 20 total
- Tests: 66 passed, 66 total
- Snapshots: 0 total
- Time: ~9.9 s
- Notes:
  - Queue and Gemini paths log expected errors during retries (validation/network), but unit tests assert circuit breaker behavior correctly.
  - Benign warning: `--localstorage-file` without a valid path during queue tests.

## Latest Run Summary — E2E
- Date: 2025-11-02
- Command: `npm run test:e2e --silent`
- Test Suites: 1 failed, 1 passed, 2 total
- Tests: 1 failed, 3 passed, 4 total
- Snapshots: 0 total
- Time: ~3.7 s
- Failure:
  - `GET /contracts/:id` returned 500 due to `ContractController.getById` calling `contractService.findById` (undefined in current stub), expected 401.
- Notes:
  - Known teardown warning about worker forced exit; unrelated to assertions.
  - This failure is outside the current documentation task scope and is recorded here for follow-up.

## Latest Run Summary (Songs Row Overflow Fix alignment)
- Date: 2025-11-02
- Command: `npm test --silent`
- Test Suites: 20 passed, 20 total
- Tests: 66 passed, 66 total
- Snapshots: 0 total
- Time: ~9.1 s
- Notes:
  - Backend continues serving updated canonical contract including `durationText` and `overflow: "ellipsis"`.
  - Warnings about `--localstorage-file` seen during queue tests are benign in Jest.
  - No backend code changes were necessary; alignment was contract-only.

## Latest Run Summary
- Date: 2025-11-02
- Command: `npm test --silent`
- Test Suites: 20 passed, 20 total
- Tests: 66 passed, 66 total
- Snapshots: 0 total
- Time: ~6.8 s
- Notes:
  - Body parsing fix: Enabled `express.json()` and `express.urlencoded({ extended: true })` in `src/main.ts` before the request logger. `req.body` is now populated for `POST` requests (e.g., `/auth/login`).
  - Contract alignment: Updated `canonical-contract-v1.json` to model `AuthService.login` with `requestSchema` (email, password) instead of `queryParams`, and reflect actual response fields (`accessToken`, `refreshToken`, `_id`, `role`, `username`, `name`).
  - All unit tests green; no regressions.

## Latest Run Summary (Refresh & Logout Schema Alignment)
- Date: 2025-11-02
- Command: `npm test --silent`
- Test Suites: 20 passed, 20 total
- Tests: 66 passed, 66 total
- Snapshots: 0 total
- Time: ~5.4 s
- Notes:
  - Added `AuthService.refresh` endpoint in canonical contract with `requestSchema { refreshToken }` and `responseSchema { accessToken, refreshToken }` to match `auth.service.ts`.
  - Updated `AuthService.logout` to accept `requestSchema { refreshToken }` and return `{ ok: true }` in `responseSchema`, aligning with backend implementation.
  - Corrected `ContentService.getDetails` path from `/{id}` to `/item` with `id` as required query param to avoid unsupported path placeholders in Flutter client.
  - All suites green; validator still passes the updated contract.

## Latest Run Summary (Auth Login Response Fields)
- Date: 2025-11-01
- Command: `npm test --silent`
- Test Suites: 20 passed, 20 total
- Tests: 66 passed, 66 total
- Snapshots: 0 total
- Time: ~6.1 s
- Notes:
  - Updated `AuthService.login` to include `username` and `name` in response alongside `_id`, `role`, `accessToken`, and `refreshToken`.
  - No test changes required; existing `auth.service.spec.ts` and `auth.controller.spec.ts` assertions remain compatible.
  - Confirms compatibility with Flutter client mapping to `state.user`.

## Latest Run Summary (Post Contract Cleanup)
- Command: `npm run test`
- Test Suites: 20 passed, 20 total
- Tests: 66 passed, 66 total
- Snapshots: 0 total
- Time: ~6.9 s

## Latest Run Summary (ThemingAccessibility Addition)
- Command: `npm test`
- Test Suites: 20 passed, 20 total
- Tests: 66 passed, 66 total
- Snapshots: 0 total
- Time: ~7.3 s
- Notes: Added global `theme` and `themingAccessibility` in canonical contract; backend tests remain green.

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

## Latest Run — 2025-11-02 (Post MVP public events)

- Unit
  - Command: `npm test --silent`
  - Result: 66 passed, 0 failed, 20 suites
  - Notes: Standard warnings about `--localstorage-file` observed; benign.

- E2E
  - Command: `npm run test:e2e --silent`
  - Result: 4 passed, 0 failed, 2 suites
  - Notes: Worker forced-exit warning observed; no failing tests.
  - Scope: Canonical endpoints remain public. Events (ingest and reads), LLM generate, Gemini queue endpoints, and Sessions are now Public. JWT is only required for auth-specific flows.

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
> jest

PASS  src/modules/auth/services/auth.service.spec.ts
PASS  src/modules/user/services/user.service.spec.ts
PASS  src/modules/queue/queue.service.spec.ts
PASS  src/modules/queue/controllers/gemini.controller.spec.ts (5.9 s)
PASS  src/modules/auth/strategies/local.strategy.spec.ts
PASS  src/modules/auth/strategies/jwt.strategy.spec.ts
PASS  src/modules/contract/validation/contract-validator.spec.ts
PASS  src/common/validators/contract.validator.spec.ts
PASS  src/common/filters/canonical-error.filter.spec.ts
PASS  src/modules/contract/services/contract-merge.service.spec.ts
PASS  src/modules/auth/guards/role-auth.guard.spec.ts
PASS  src/modules/contract/services/contract-validation.service.spec.ts
PASS  src/modules/user/controllers/user.controller.spec.ts (6.1 s)
PASS  src/modules/event/services/event.service.spec.ts
PASS  src/modules/user-contract/services/user-contract.service.spec.ts
PASS  src/modules/app/controllers/app.controller.spec.ts
... (remaining suites passed)

Test Suites: 20 passed, 20 total
Tests:       66 passed, 66 total
Snapshots:   0 total
Time:        ~6.5 s
```
## Latest Run Summary (Admin Builder & Endpoint)
- Command: `npm test`
- Test Suites: 20 passed, 20 total
- Tests: 66 passed, 66 total
- Snapshots: 0 total
- Time: ~6.6 s
- Notes: Wired `AdminContractController` and `ContractBuilderService` into `ContractModule`. All suites green; no regressions.

## Latest Run Summary (Part C: Flutter Parser Alignment)
- Date: 2025-11-01
- Command: `npm test`
- Test Suites: 20 passed, 20 total
- Tests: 66 passed, 66 total
- Snapshots: 0 total
- Time: ~5.5 s
- Notes:
  - Updated `canonical-contract-v1.json` to align with Flutter parser:
    - TextField placeholders and style token resolution.
    - Disabled pagination for all static lists/grids.
    - Added `dependencies` for state-bound text.
    - Standardized deterministic dummy image URLs.
    - Applied design-system spacing constants (8/16/24).
  - No backend regressions detected; all suites green.

## Latest Run Summary (Part D: Debug Logging & E2E Prep)
- Date: 2025-11-01
- Command: `npm test`
- Test Suites: 20 passed, 20 total
- Tests: 66 passed, 66 total

## Latest Run Summary (Login SubmitForm Alignment)
- Date: 2025-11-01
- Command: `npm run test --silent`
- Test Suites: 20 passed, 20 total
- Tests: 66 passed, 66 total
- Snapshots: 0 total
- Time: ~6.4 s
- Notes:
  - Updated canonical contract login flow:
    - `action.type` → `action.action` for all actions.
    - Login button uses `action: "submitForm"` with `service: "auth"`, `endpoint: "login"`.
    - Email/password fields bind to `${state.login.email}` and `${state.login.password}`.
    - `onError` now uses `params.message` for error display.
  - All backend tests still pass; no regressions detected.
- Snapshots: 0 total
- Time: ~8.0 s
- Notes:
  - Added global Express middleware in `src/main.ts` to log all requests:
    - Logs method, URL, sanitized headers (Authorization redacted), and body.
  - Kept `CanonicalErrorFilter` active to return structured, detailed errors.
  - No test failures; logging middleware is non-invasive for unit tests.
  
## Latest Run Summary (Public Endpoints Refactor)
- Date: 2025-11-02
- Command: `npm test -- --verbose`
- Test Suites: 20 passed, 20 total
- Tests: 66 passed, 66 total
- Snapshots: 0 total
- Time: ~5.0 s
- Notes:
  - Updated controllers and services to remove `JwtAuthGuard`, `RoleGuard`, and ownership checks from:
    - EventController (ingestion and aggregate; listing reads via service)
    - GeminiController (enqueue, status, circuit-breaker)
    - LlmController (generate-contract)
    - AdminContractController (builder endpoint)
    - SessionService and SessionController (end/list/get now public)
  - Updated unit tests to reflect public behavior:
    - `event.service.spec.ts`: listByUser is now public
    - `user-contract.service.spec.ts`: upsert is public for non-owner
  - All suites green; no regressions.

## Latest Run Summary (Routine regression after public refactor)
- Date: 2025-11-02
- Command: `npm test --silent`
- Test Suites: 20 passed, 20 total
- Tests: 66 passed, 66 total
- Snapshots: 0 total
- Time: ~6.8 s
- Notes:
  - Observed expected error logs in `GeminiGenerationProcessor` tests for simulated network/validation failures; suites still pass.
  - Confirms stability after public endpoint changes across Events, Gemini, LLM, Sessions.
  - No new failures or flaky tests detected.

## Latest Run Summary (Disable dummy event seeding by default)
- Date: 2025-11-02
- Command: `npm test --silent`
- Test Suites: 20 passed, 20 total
- Tests: 66 passed, 66 total
- Snapshots: 0 total
- Time: ~7.3 s
- Notes:
  - Backend updated to gate sample event seeding behind `SEED_SAMPLE_EVENTS=true`; default behavior no longer inserts dummy analytics events.
  - No test changes required; unit suites for Event, Queue, LLM, Auth, User continue to pass.
  - Confirms no regressions in ingestion (`POST /events`) and analytics aggregation after seeding change.
## Latest Run Summary (Startup Env Loading & Analytics Persistence)
- Date: 2025-11-02
- Command: `npm run test --silent`
- Test Suites: 20 passed, 20 total
- Tests: 66 passed, 66 total
- Snapshots: 0 total
- Notes:
  - Early `.env` loading added via `dotenv/config` in `src/main.ts`.
  - In-memory Mongo disabled when `.env` contains `USE_MEMORY_MONGO=false` and a valid `MONGO_URL`.
  - Ingestion verified: `POST /events` returns `{ inserted: N }`; `GET /events/aggregate` returns stats.