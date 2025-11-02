Project: nestjs-mongo (NestJS)
# LLM Analytics & Caching

## Overview
- Purpose: compute per-user analytics and pain points to guide contract optimization.
- Location: `src/modules/llm/services/gemini.service.ts` (core aggregation and provider-backed generation) and `src/modules/llm/services/llm.service.ts` (heuristic fallback).

## Aggregated Analytics
- Event distribution: counts by `eventType` (e.g., `view`, `tap`, `submit`, `error`).
- Error analysis: groups errors by `componentId` and message; produces `errorRate` and hotspots.
- Rage clicks: flags components with rapid repeated taps (≥3 within ~1s).
- Form abandonment: detects repeated submits with no success or emits errors around form interactions.
- Long dwell: detects components/pages with unusually long dwell times (e.g., >120s).
- Component usage: tallies interactions per `componentId`.

Example aggregated analytics payload stored in cache (`llm:analytics:{userId}`):
```json
{
  "userId": "64f5b7e86831d4f215d7b8d4",
  "eventTypeDistribution": {
    "view": 42,
    "tap": 31,
    "submit": 5,
    "error": 6
  },
  "errorRate": 0.125,
  "hotspots": [
    { "componentId": "email-input", "errors": 3 },
    { "componentId": "submit-btn", "errors": 2 }
  ],
  "painPoints": [
    {
      "type": "rage-click",
      "componentId": "submit-btn",
      "reason": "3 taps in 980ms",
      "metrics": { "tapBurst": 3, "windowMs": 980 }
    },
    {
      "type": "error-pattern",
      "componentId": "email-input",
      "reason": "invalid email format",
      "metrics": { "count": 3 }
    }
  ],
  "computedAt": "2023-10-03T10:00:00.000Z"
}
```

## Pain Points
- Types: `rage-click`, `form-abandonment`, `error-pattern`, `long-dwell`.
- Each pain point includes `componentId`, a short `reason`, and supporting `metrics`.

## Improvement Suggestions
- Derived from LLM analysis of recent events and detected pain points.
- Shape: `{ title, description, elementId?, page?, priority }` with `priority` in `low|medium|high`.
- Returned by `POST /gemini/analyze-events` alongside `painPoints`.

## Caching
- Key: `llm:analytics:{userId}`
- TTL: 300 seconds
- Behavior: aggregation fetches cached analytics first; on miss, computes, caches, and returns.
- Implementation: `CacheService` (Redis-backed, optional). Caching is gracefully disabled if Redis is unavailable.

Example Redis entry:
```
SETEX llm:analytics:64f5b7e86831d4f215d7b8d4 300 "{...json above...}"
```

## Generation Flows
- Synchronous: `POST /llm/generate-contract` (Public)
  - Uses aggregated analytics and either provider-backed generation (when configured) or heuristic fallback.
  - Persists result via `ContractService` and returns standardized `ContractDto`.
  - Prompt composition (technical):
    - Includes `eventTypeDistribution`, `errorRate`, and `painPoints`.
    - Embeds `baseContract.meta.description` and selected `pagesUI` components to focus optimization scope.
    - Adds guardrails to avoid unsupported fields based on `nest-contract-validation.md`.

- Asynchronous (Admin): `POST /gemini/generate-contract`
  - Enqueues a background job; `GET /gemini/jobs/:jobId` returns status; `POST /gemini/circuit-breaker/reset` resets circuit.
  - Processor attaches `meta.optimizationExplanation` and stores `analytics` when present.
  - Queue processor steps:
    - Load cached analytics or compute anew.
    - Call `GeminiClient` with composed prompt and model from configuration (`GEMINI_MODEL`, default `gemini-2.5-flash`).
    - Validate returned contract schema; persist via `ContractService`.
    - Update job status with result `{ contractId, version }`.

## Provider Configuration
- `LLM_PROVIDER`: `openai`, `anthropic`, or `gemini`.
- Gemini
  - Env: `GEMINI_API_KEY`, `GEMINI_MODEL` (default `gemini-2.5-flash`), optional `GEMINI_BASE_URL`.
  - Client: `src/modules/llm/clients/gemini.client.ts`.

## Failure Handling
- Circuit breaker: prevents repeated remote failures; returns `503` while open.
- Timeouts/backoff: configured via queue env (`QUEUE_GEMINI_*`).
- Fallbacks: `fallbackHeuristic` and `fallbackSafe` produce a valid contract when provider calls fail.

Example failed job status:
```json
{
  "id": "gem-8a74b7d0-9f1e-4e37-b7c0-29b1b060c3bb",
  "status": "failed",
  "progress": 60,
  "result": null,
  "error": "Provider timeout after 20s",
  "timestamps": {
    "createdAt": "2023-10-03T10:00:00.000Z",
    "startedAt": "2023-10-03T10:00:02.000Z",
    "completedAt": "2023-10-03T10:00:22.000Z"
  }
}
```

## DTOs
- `GenerateContractRequestDto`: `userId` (required), `baseContract?`, `version?`.
- Job responses: `EnqueueJobResponseDto`, `GeminiJobStatusDto` for queue endpoints.

Example `GenerateContractRequestDto` (full):
```json
{
  "userId": "64f5b7e86831d4f215d7b8d4",
  "baseContract": {
    "meta": { "description": "Personal finance onboarding flow" },
    "pagesUI": { "pages": { "onboarding": { "components": [] } } }
  },
  "version": "1.2.0"
}
```

Example `ContractDto` (standardized):
```json
{
  "id": "651c0f0a1d6d7e6a4e3b1c6d",
  "userId": "64f5b7e86831d4f215d7b8d4",
  "version": "1.2.1",
  "json": { /* ... */ },
  "createdAt": "2023-10-03T10:00:00.000Z",
  "updatedAt": "2023-10-03T10:00:00.000Z",
  "meta": {
    "optimizedBy": "gemini",
    "optimizedByModel": "gemini-2.5-flash",
    "optimizationExplanation": "Reduce clicks on submit with clearer CTA.",
    "analytics": { "errorRate": 0.15 }
  }
}
```

## Notes
- Sessions: when present, analytics can group by `sessionId` to improve attribution.
- Versions: generation bumps patch version (`x.y.z → x.y.(z+1)`), defaulting to `0.1.0` when invalid.