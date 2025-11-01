Project: nestjs-mongo (NestJS)
# Response Compression (gzip)

## Overview
- Adds HTTP response compression for eligible payloads using `compression` middleware.
- Reduces JSON payload sizes and bandwidth; improves perceived latency.

## Installation
- Install runtime dependency: `npm i compression`
- Install TypeScript types: `npm i -D @types/compression`

## Implementation (src/main.ts)
- Import and register middleware before any routes or response-sending middleware.

```ts
import * as compression from 'compression';

// ... inside bootstrap()
app.use(
  compression({
    level: 6,       // balance compression ratio and CPU
    threshold: 1024 // only compress 1KB+ responses
  })
);
```

Notes:
- Keeps `MONGO_URL` unchanged; no impact on DB connectivity.
- Default filter respects client `Accept-Encoding`; gzip is applied when requested.

## Verification Steps
1) Start dev server: `REDIS_URL=redis://127.0.0.1:6379 npm run start:dev`
2) Inspect headers (identity vs gzip):
   - Identity (no compression):
     - `curl -s -D - -H 'Accept-Encoding: identity' http://localhost:8081/contracts/canonical -o /dev/null | grep -iE 'content-length|content-encoding'`
   - Gzip:
     - `curl -s -D - -H 'Accept-Encoding: gzip' http://localhost:8081/contracts/canonical -o /dev/null | grep -iE 'content-length|content-encoding'`
3) Measure body sizes:
   - Identity bytes: `curl -s -H 'Accept-Encoding: identity' http://localhost:8081/contracts/canonical | wc -c`
   - Gzip bytes: `curl -s -H 'Accept-Encoding: gzip' http://localhost:8081/contracts/canonical --output - | wc -c`

## Results (local)
- Endpoint: `GET /contracts/canonical`
- Identity `Content-Length`: `2248` bytes
- Gzip `Content-Encoding`: `gzip`
- Identity body size: `2248` bytes
- Gzip body size: `910` bytes (~59.5% reduction)

## Client Compatibility
- Browser: Modern browsers automatically advertise and handle gzip.
- Postman: Sends `Accept-Encoding` and displays decoded payload.
- curl: Use `-H 'Accept-Encoding: gzip'` to request compression; `--compressed` auto-decodes locally.

## Success Metrics
- `Content-Encoding: gzip` present for applicable responses.
- JSON payload reductions typically 60–80%; actual size depends on content.
- No garbled responses across clients.