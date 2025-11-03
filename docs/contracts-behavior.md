Project: nestjs-mongo (NestJS)
Contracts: Generation, Storage, and Serving Behavior

Overview
- Defines three contract types: canonical (global baseline), personalized (user-specific overrides), and merged (canonical + personalized for a specific user).
- Canonical and personalized contracts can be seeded from disk in development, generated via LLM endpoints, or created via admin APIs.
- Read endpoints apply caching to reduce database load and improve latency.

Sources of Contracts
- Canonical (disk): `src/modules/app/data/canonical-contract-v1.json`.
- Personalized (disk): `src/modules/app/data/personalized-contract-example.json`.
- LLM generation: `POST /llm/generate-contract` (and `POST /gemini/generate-contract`) produces optimized contracts based on a base contract and context.
- Manual creation: `POST /contracts` and `POST /users/:id/contract` allow admin-authored or tool-authored contracts to be recorded.

Seeding (development)
- Controlled by `SEED_ENABLED=true` (set in `.env`), runs on app startup.
- Loads canonical JSON from disk and upserts the latest canonical into the `Contract` collection (no `userId`).
- Loads personalized JSON from disk and seeds:
  - A personalized contract in `Contract` collection with `userId` assigned to the demo user.
  - A personalized snapshot in `UserContract` collection keyed by `(userId, contractId)` when applicable.
- Invalidates caches after seeding to ensure fresh reads:
  - Canonical key: `contracts:canonical`.
  - User key: `contracts:user:{userId}`.

Storage Model
- `Contract` (canonical & personalized):
  - `json`: the contract content.
  - `version`: semantic version string.
  - `meta`: arbitrary metadata (author, description, updatedAt, etc.).
  - `userId`: absent/null for canonical; present for personalized.
  - `createdBy`, `createdAt`, `updatedAt` populated by the backend.
- `UserContract` (personalized snapshot):
  - `userId`, optional `contractId`, and `json`.
  - Unique index on `(userId, contractId)` when present; last-write wins.

Serving Endpoints
- Canonical (public):
  - `GET /contracts/canonical` — latest canonical contract.
  - `GET /contracts/public/canonical` — alias; identical response.
  - Caching: TTL 300s via `CacheService` under `contracts:canonical`.
  - Flutter filtering: response JSON is filtered to include only Flutter-supported components.
- Merged (authenticated):
  - `GET /users/:id/contract` — merges latest canonical with latest personalized for the user.
  - Caching: TTL 300s (`Cache-Control: private, max-age=300`); server-side key `contracts:user:{id}`.
  - Response uses canonical `version` and `meta` by default, with personalized JSON overrides applied where present.
  - Flutter filtering: merged JSON is filtered to include only Flutter-supported components.
- Personalized management (authenticated):
  - `GET /contracts/user/:userId` — returns the latest personalized snapshot stored in `UserContract`.
  - `POST /contracts/user/:userId` — upserts a personalized snapshot; only the user or `ADMIN` may write.
- Contract creation (authenticated):
  - `POST /contracts` — creates a new contract record.
  - `POST /users/:id/contract` — creates a new user-targeted contract in the `Contract` collection.
- LLM (authenticated):
  - `POST /llm/generate-contract` — generates an optimized contract, then records it in `Contract` for the target `userId`.
  - `POST /gemini/generate-contract` — same flow using Gemini provider.

Merging Semantics
- The merge is performed by `ContractMergeService`, treating canonical as the base and personalized JSON as a partial override.
- Personalized fields take precedence (e.g., UI layout tweaks, component properties, page definitions). Missing fields fall back to canonical.
- Example: canonical `music` page grid columns `2` overridden by personalized `3`; home title remains `Dashboard`.

Caching Behavior
- TTL: 300 seconds for canonical and merged user reads.
- Keys: `contracts:canonical`, `contracts:user:{id}`.
- When Redis is not configured, `CacheService` gracefully disables caching; endpoints still function.
- Client response header on merged endpoint: `Cache-Control: private, max-age=300`.

Quick Verification (curl)
- Login and fetch user id:
  - `ACCESS_TOKEN=$(curl -s -X POST http://localhost:8081/auth/login -H 'Content-Type: application/json' -d '{"email":"test@example.com","password":"password123"}' | jq -r '.accessToken')`
  - `USER_ID=$(curl -s -X POST http://localhost:8081/auth/login -H 'Content-Type: application/json' -d '{"email":"test@example.com","password":"password123"}' | jq -r '.userId')`
- Canonical:
  - `curl -s http://localhost:8081/contracts/canonical | jq -r '[.version, .json.meta.appName] | @tsv'`
- Merged for user:
  - `curl -s http://localhost:8081/users/$USER_ID/contract -H "Authorization: Bearer $ACCESS_TOKEN" | jq -r '[ (.json.pagesUI.pages.music.children[] | select(.type=="grid") | .columns), (.json.pagesUI.bottomNavigation.items[0].label) ] | @tsv'`
- Headers:
  - `curl -s -D - http://localhost:8081/users/$USER_ID/contract -H "Authorization: Bearer $ACCESS_TOKEN" -o /dev/null | grep -i "cache-control"`

Update & Customize
- Edit the disk JSON files under `src/modules/app/data/` to change canonical or personalized defaults in development.
- Restart the server (`npm run start`) to re-run seeding and apply changes; caches are invalidated automatically.
- In production, disable seeding (`SEED_ENABLED=false`) and manage contracts via admin or LLM endpoints.

Limitations & Notes
- Personalized snapshot (`UserContract`) is last-write wins and does not maintain history.
- Merged responses use canonical `meta` and `version` by default; consider explicit combined metadata if needed.
- Consider adding version history, diffs, and audit logs for production.

Flutter Contract Filtering
- Purpose: ensure backend returns contracts that the Flutter app can parse/render.
- Applied on: `GET /contracts/canonical`, `GET /contracts/public/canonical`, and `GET /users/:id/contract`.
- Allowed component types:
  - `text`, `textField`, `button`, `textButton`, `icon`, `iconButton`, `image`, `card`, `list`, `grid`, `row`, `column`, `center`, `hero`, `form`, `searchBar`, `chip`, `progressIndicator`, `switch`, `slider`, `audio`, `video`, `webview`.
- Aliases and normalizations:
  - `text_field` → `textField`.
  - `progressBar` → `progressIndicator`.
  - `list.itemTemplate` → `list.itemBuilder` (recursively normalized).
  - `searchBar.action` → `searchBar.onChanged`.
  - Unsupported wrappers (e.g., `section`, `chipGroup`) are flattened to their normalized `children`; unsupported leaf nodes are dropped.
- Behavior is implemented by `FlutterContractFilterService` and is idempotent.

Contract Cleanup (2025-11-01)
- Canonical and personalized disk contracts were updated to remove unknown/unsupported UI types.
- Changes applied to align strictly with the allowed Flutter component set:
  - Replaced `section` with a `column` plus a `text` heading for readability.
  - Converted `chipGroup` to a `row` of actionable `chip` components.
  - Converted `dropdown` to a `row` of `chip` options driving `updateState`.
  - Replaced `floatingActionButton` with `iconButton` preserving the `action`.
  - Replaced `progressBar` with `progressIndicator`, keeping `value`/`max`.
- Additionally normalized properties in disk JSON to match runtime normalization:
  - `searchBar.action` → `onChanged`.
  - Ensured list/grid `itemTemplate` structures are compatible with the list builder pattern.
- Result: disk-seeded contracts no longer contain unknown content; runtime filtering remains as a safety net.

Logout Action Update (2025-11-03)
- Canonical contract logout button now uses `authLogout` instead of a generic `apiCall`.
- Rationale: generic `apiCall` did not include `refreshToken` and failed with 400; `authLogout` ensures the Flutter client clears tokens/state, reverts to canonical contract, and navigates to `/login` reliably.
- Impact: eliminates the in-app "Logout failed" toast and aligns UX with secure session teardown.