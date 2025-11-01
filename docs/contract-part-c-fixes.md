# Contract Part C: Flutter Parser Alignment

Date: 2025-11-01

This document details changes applied to `src/modules/app/data/canonical-contract-v1.json` to align the contract with the Flutter renderer/parser expectations.

## Overview

- Goal: Ensure theme tokens, text fields, pagination, bindings, images, and spacing adhere to conventions the Flutter renderer expects.
- Scope: Pages `landing`, `login`, `home`, `music`, `podcasts`, `ebooks` and their child components.

## Changes by Step

### 1) Theme Token Resolution for Page Backgrounds
- Contract: Verified every page includes `style.backgroundColor: "${theme.background}"`.
- Flutter: PageRenderer should resolve `${theme.background}` → token lookup → hex → `Scaffold(backgroundColor: resolvedColor)`.

### 2) TextFields: Placeholder and Styles
- Login page email field:
  - Changed `label: "Email"` → `placeholder: "Enter your email"`.
  - Added style tokens: `fillColor`, `focusedBorderColor`, `hintStyle.color` using `${theme.surface}`, `${theme.primary}`, `${theme.onSurface}`.
- Login page password field:
  - Changed `label: "Password"` → `placeholder: "Enter your password"`.
  - Added same style tokens as email field.
- Spacing: TextField margins standardized to `16` (md).

### 3) Pagination for Static Collections
- For every `list`/`grid` with `dataSource.type: "static"`, added:
  ```json
  "pagination": { "enabled": false }
  ```
- Applied to: `featuredList`, `recentList`, `musicList`, `podcastGrid`, `ebookList`.

### 4) Explicit Bindings for State-Based Text
- Any text using `${state.*}` now includes a `dependencies` array.
- Applied to `home` username text:
  ```json
  { "type": "text", "text": "${state.user.name}", "dependencies": ["state.user.name"] }
  ```

### 5) Deterministic Dummy Images
- Standardized image URLs to deterministic patterns:
  - Featured cards: `https://picsum.photos/120/120?random=featured_1..3`
  - Music items: `https://via.placeholder.com/60x60/1DB954?text=Music_1..ALB`
  - Podcasts grid: `https://via.placeholder.com/150x150/34C759?text=Podcasts_1..4`
  - Ebooks list: `https://via.placeholder.com/120x160/FF9500?text=Book_1..3`

### 6) Design System Spacing Constants
- Ensured spacing values are only `8` (sm), `16` (md), or `24` (xl).
- Adjustments:
  - Login card padding: `24` → `16`.
  - Login title margin-bottom: `32` → `24`.
  - Home greeting margin-bottom: `4` → `8`.
  - Home username margin-bottom: `32` → `24`.
  - Featured item text margin-top: `4` → `8`.
  - Music list image margin-right: `12` → `8`.
  - Ebooks card padding: `12` → `16`; image margin-right: `12` → `8`.

## Flutter Parser Expectations (Reference)

- Theme tokens: `${theme.<name>}` must resolve from `themingAccessibility.tokens[defaultTheme]`.
- TextField styles:
  - Use style keys: `fillColor`, `focusedBorderColor`, `hintStyle.color`.
  - Prefer resolving via tokens, not hardcoded hex.
- Collections:
  - `dataSource.type: "static"` should honor `pagination.enabled`.
  - `itemBuilder` receives `item` context; `dependencies` are only required for `${state.*}` bindings.
- Spacing: Use `8/16/24`; avoid magic numbers (e.g., 12, 32).

## Validation and Testing

- Backend unit tests: `npm test` — 20 suites, 66 tests passed; no regressions.
- See `docs/nest-test-results.md` for the latest run summary.

## Impact and Next Steps

- Flutter Renderer should now properly apply page backgrounds, TextField styles, disable pagination for static content, resolve state-bound text with dependencies, and maintain consistent spacing.
- Recommended follow-ups:
  - Add Flutter-side unit/widget tests to confirm token resolution and TextField styling.
  - Extend contract validator to flag non-constant spacings or missing `dependencies` for `state.*` bindings.