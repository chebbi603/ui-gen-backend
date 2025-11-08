Project: nestjs-mongo (NestJS)
# Contract Validation

This document describes the contract validation system now implemented in the backend. It explains what is validated, how the rules are discovered, how to use the service, and the structure of the returned results.

## Overview

The validator checks canonical JSON contracts and returns structured results:
- Required sections: `version` (string, non-empty), `meta`, `pagesUI`, `thresholds` (object with numeric values)
- Optional sections: `eventsActions`, `services`, `state`, `assets`, and any additional top-level keys; unknown keys are allowed and ignored by the validator.
- Pages and components: supported `type`, bindings format, inline `validation` rules
- Component actions: `onTap`, `onChanged`, `onSubmit` with required parameters per action
- Routes: `pagesUI.routes` reference existing `pagesUI.pages`
- Services: response schema structure for `endpoints[*].responseSchema`, focusing on `data` property and `$ref`s to `dataModels`
- State: scope (`global`, `page`, `session`, `memory`), persistence (`local`, `secure`, `session`, `memory`), and field types
- Cross-references: icon names used in pages vs `assets.icons.mapping`

## Supported Features

Supported lists (components, actions, validations) are derived from docs when available:
- `docs/dsl_cheat_sheet.md` is parsed to extract supported component `type` values and allowed action names
- `docs/components_reference.md` is parsed to extract inline `validation` keys

If docs are missing or do not include these lists, the validator falls back to built-in defaults.

## Action Schema Update (Flutter Alignment)

To align canonical contracts with the Flutter parser and dispatcher:
- Use `action` (string) inside action objects instead of `type`.
- For navigation:
  - Example: `{ "action": "navigate", "route": "/login" }`
- For form submission:
  - Example (login):
    ```json
    {
      "action": "submitForm",
      "service": "auth",
      "endpoint": "login",
      "params": { "formId": "login" },
      "onSuccess": { "action": "navigate", "route": "/home" },
      "onError": { "action": "showError", "params": { "message": "Login failed" } }
    }
    ```
- For error/success dialogs: provide messages via `params.message`.

Text field bindings:
- Bind input fields to page state using `binding` with `${state.<pageId>.<key>}`.
- Example: email/password on `login` page
  - Email: `"binding": "${state.login.email}"`, keyboard `"email"`
  - Password: `"binding": "${state.login.password}"`, `"obscure": true`

Notes:
- Backend `FlutterContractFilterService` normalizes `keyboard` → `keyboardType` and `obscure` → `obscureText` for Flutter widgets.
- The validator flags actions missing required fields (e.g., `apiCall` without `service`/`endpoint`). Using `submitForm` for auth login is recommended to ensure proper state collection.

## Integration

Use the NestJS `ContractValidationService` to validate contracts:

```ts
import { ContractValidationService } from 'src/modules/contract/services/contract-validation.service';

constructor(private readonly contractValidation: ContractValidationService) {}

const detailed = this.contractValidation.validate(contract);
// detailed: { isValid, errors, warnings, stats }

const simple = this.contractValidation.validateSimple(contract);
// simple: { valid, errors?: string[] }
```

Existing code that uses `validateContractJson(json)` continues to work — it now delegates to the new validator internally.

## Result Structure

Detailed result (`ValidationResult`):
- `isValid`: boolean
- `errors`: array of `{ path: string; message: string }`
- `warnings`: array of `{ path: string; message: string }`
- `stats`: `{ pages, components, actions }`

Simple result (`{ valid, errors?: string[] }`) is provided for compatibility and contains formatted messages like `"path: message"`.

## Examples

Minimal invalid contract:
```json
{}
```
Returns errors:
- `version: Required section missing or invalid`
- `meta: Required section missing or invalid`
- `pagesUI: Required section missing or invalid`
- `thresholds: Required section missing or invalid`

Minimal valid contract:
```json
{
  "version": "1.0.0",
  "meta": {},
  "thresholds": { "llmConfidence": 0.7 },
  "pagesUI": { "pages": {} }
}
```

Action validation example:
```json
{
  "meta": {},
  "pagesUI": {
    "pages": {
      "home": { "children": [{ "type": "button", "onTap": { "action": "apiCall" } }] }
    }
  }
}
```
Returns errors:
- `pagesUI.pages.home.children[0].onTap: apiCall requires service and endpoint`

## Tips

- Prefer `$ref` references to `dataModels` for response `data` shapes.
- Keep `routes` in sync with `pages` — a missing `pageId` produces an error.
- Inline `validation` keys outside the supported set are flagged as warnings.
- For icons: use `assets.icons.mapping` to map icon names referenced in pages.

## Version and Thresholds Requirement (2025-11-05)

- `version` is now required at the top level and must be a non-empty string. Semver formatting (e.g., `"1.0.0"`) is recommended and used by the backend when stamping generated contracts.
- `thresholds` is now required and must be an object whose values are numeric. The validator produces warnings for any non-numeric entries under `thresholds`.
- Generation and fallbacks ensure `version` and `thresholds` are present before validation and persistence.

## Files

- Validator: `src/modules/contract/validation/contract-validator.ts`
- Service: `src/modules/contract/services/contract-validation.service.ts`
- Types: `src/common/validation/validation-result.ts`
- Legacy wrapper: `src/common/validators/contract.validator.ts`
## State Field Type Rules

- The `state.global` and `state.pages` entries must explicitly declare `type`.
- Default behavior: missing `type` is treated as `string` by clients; this can corrupt object fields.
- Use `type: "object"` for map-like fields (e.g., `user` modeled on `User`).
- Canonical contract updated: `state.global.user` includes `type: "object"` to align with client casting and validation.