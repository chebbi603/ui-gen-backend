import { ContractValidator } from '../../modules/contract/validation/contract-validator';

export type ContractValidationResult = { valid: boolean; errors?: string[] };

export function validateContractJson(json: any): ContractValidationResult {
  // Delegate to the new ContractValidator for comprehensive checks.
  const result = new ContractValidator().validateContract(json ?? {});
  const errors = result.errors.map((e) => `${e.path}: ${e.message}`);
  return { valid: result.isValid, errors: errors.length ? errors : undefined };
}
