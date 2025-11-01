# Redis Caching Verification

This document verifies Redis connectivity and cache behavior for the canonical contract endpoints without modifying your existing `.env` `MONGO_URL`.

## Scope

- Validate Redis connection using a runtime override (`REDIS_URL`) and observe health output.
- Verify cache behavior on `GET /contracts/canonical` and `/contracts/public/canonical`.
- Confirm graceful degradation when Redis is unavailable (requests still succeed without cache).

## Prerequisites

- Keep your `.env` `MONGO_URL` unchanged.
- Ensure a Redis server is available (e.g., `redis://127.0.0.1:6379`).
- Node and npm installed.

## Start the backend (no .env changes)

Use a runtime override for Redis only:

```
REDIS_URL=redis://127.0.0.1:6379 npm run start:dev
```

Expected logs:

- Redis health check: `[Redis] Connection OK (PONG)` (from bootstrap `main.ts`).
- Server listens on `PORT=8081`.

## Verify cache behavior

Measure first and second call latency with curl:

```
curl -s -o /dev/null -w "HTTP=%{http_code} time=%{time_total}\n" http://localhost:8081/contracts/canonical
curl -s -o /dev/null -w "HTTP=%{http_code} time=%{time_total}\n" http://localhost:8081/contracts/canonical
```

Expected:

- First call: cache miss (slower). Second call: cache hit (faster).
- Both responses should be `HTTP=200`.

Verify response headers:

```
curl -I http://localhost:8081/contracts/canonical | grep -i cache-control
curl -I http://localhost:8081/contracts/public/canonical | grep -i cache-control
```

Expected header: `Cache-Control: public, max-age=300`.

## Graceful degradation (Redis unavailable)

Restart with an invalid Redis override:

```
REDIS_URL=redis://127.0.0.1:6390 npm run start:dev
```

Expected logs:

- Redis connection warnings are logged.
- Requests still return `HTTP=200` (no cache used).

## Success metrics

- Redis PING: `PONG` present in startup logs.
- Canonical endpoint header: `Cache-Control: public, max-age=300`.
- Latency improvement: second call faster than first (indicative of cache hit).
- Degradation: no hard failures when Redis is unavailable.

## Notes

- The controller uses `CacheService` (ioredis) with lazy connect and TTL `300s`.
- Cache keys: `contracts:canonical` for canonical payload.
- Seeding will populate a default canonical contract when `SEED_ENABLED=true`.