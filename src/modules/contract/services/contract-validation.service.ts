import { Injectable } from '@nestjs/common';
import { ContractValidator } from '../validation/contract-validator';
import { ValidationResult } from '../../../common/validation/validation-result';

@Injectable()
export class ContractValidationService {
  validate(contract: Record<string, any>): ValidationResult {
    return new ContractValidator().validateContract(contract);
  }

  // Compatibility wrapper for legacy consumers expecting { valid, errors }
  validateSimple(contract: Record<string, any>): {
    valid: boolean;
    errors?: string[];
  } {
    const result = this.validate(contract);
    const errors = result.errors.map((e) => `${e.path}: ${e.message}`);
    return {
      valid: result.isValid,
      errors: errors.length ? errors : undefined,
    };
  }
}
