Project: nestjs-mongo (NestJS)
# Contract Validation

This document describes the contract validation system now implemented in the backend. It explains what is validated, how the rules are discovered, how to use the service, and the structure of the returned results.

## Overview

The validator checks canonical JSON contracts and returns structured results:
- Required sections: `meta`, `pagesUI` (and optional `eventsActions`, `services`, `state`, `assets`)
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
- `meta: Required section missing or invalid`
- `pagesUI: Required section missing or invalid`

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

## Files

- Validator: `src/modules/contract/validation/contract-validator.ts`
- Service: `src/modules/contract/services/contract-validation.service.ts`
- Types: `src/common/validation/validation-result.ts`
- Legacy wrapper: `src/common/validators/contract.validator.ts`