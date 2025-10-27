# Jest Test Results

## Latest Run Summary
- Command: `npm run test -- -i`
- Test Suites: 12 passed, 12 total
- Tests: 35 passed, 35 total
- Snapshots: 0 total
- Time: 2.281 s

## Test Suites and What They Test

- `src/modules/auth/services/auth.service.spec.ts`
  - `validateUser` matches passwords, sanitizes user (no password), returns `null` on mismatch.
  - `login` returns JWT token and user role.
  - `signUp` delegates creation to `UserService.create`.

- `src/modules/user/services/user.service.spec.ts`
  - `create` hashes the password, assigns default role, throws `ConflictException` if email exists.
  - `findAll` returns users via `find().exec()`.
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

- `src/modules/user-contract/services/user-contract.service.spec.ts`
  - `upsertUserContract` inserts/updates by `userId`.
  - `getUserContract` fetches by id using valid ObjectId strings.

- `src/modules/app/controllers/app.controller.spec.ts`
  - Adds a simple ping/health check test confirming controller responds.

## Notable Behaviors
- You may see a console log during `UserService.create` conflict scenario:
  - `ConflictException: email already exists` — this is expected and verifies conflict handling.

## Full Output (Latest Run)
```
> nestjs-mongo-boilerplate@0.0.1 test
> jest -i

 PASS  src/modules/auth/guards/role-auth.guard.spec.ts
 PASS  src/modules/user/controllers/user.controller.spec.ts
 PASS  src/modules/user/services/user.service.spec.ts
  ● Console

    console.log
      ConflictException: email already exists
          at UserService.create (/Users/chebbimedayoub/Documents/Thesis work/nestjs-mongo/src/modules/user/services/user.service.ts:24:15)
          at Object.<anonymous> (/Users/chebbimedayoub/Documents/Thesis work/nestjs-mongo/src/modules/user/services/user.service.spec.ts:51:
7) {
        response: {
          statusCode: 409,
          message: 'email already exists',
          error: 'Conflict'
        },
        status: 409,
        options: {}
      }

      at UserService.create (modules/user/services/user.service.ts:36:15)

 PASS  src/modules/auth/strategies/local.strategy.spec.ts
 PASS  src/modules/auth/services/auth.service.spec.ts
 PASS  src/modules/event/services/event.service.spec.ts
 PASS  src/modules/user-contract/services/user-contract.service.spec.ts
 PASS  src/modules/auth/controllers/auth.controller.spec.ts
 PASS  src/modules/contract/services/contract.service.spec.ts
 PASS  src/modules/auth/strategies/jwt.strategy.spec.ts
 PASS  src/modules/app/controllers/app.controller.spec.ts
 PASS  src/common/filters/canonical-error.filter.spec.ts

Test Suites: 12 passed, 12 total
Tests:       35 passed, 35 total
Snapshots:   0 total
Time:        2.281 s, estimated 3 s
Ran all test suites.
```