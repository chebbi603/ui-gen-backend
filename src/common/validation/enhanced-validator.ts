import { SimpleValidationResult } from './validation-result';

export interface ValidationConfig {
  required?: boolean;
  email?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  message?: string;
}

export interface CrossFieldRuleConfig {
  rule: 'equal';
  fields: string[];
  message?: string;
}

export interface ValidationsConfig {
  rules: Record<string, ValidationConfig>;
  crossField: Record<string, CrossFieldRuleConfig>;
}

export class EnhancedValidator {
  private config?: ValidationsConfig;

  initialize(config: ValidationsConfig) {
    this.config = config;
  }

  validateField(
    fieldName: string,
    value: unknown,
    config: ValidationConfig,
  ): SimpleValidationResult {
    if (
      config.required === true &&
      (value == null || String(value).trim().length === 0)
    ) {
      return {
        isValid: false,
        message: config.message ?? 'This field is required',
      };
    }

    if (value == null || String(value).trim().length === 0) {
      return { isValid: true };
    }

    const stringValue = String(value);

    if (config.email === true) {
      if (!this.isValidEmail(stringValue)) {
        return {
          isValid: false,
          message: config.message ?? 'Please enter a valid email address',
        };
      }
    }

    if (
      typeof config.minLength === 'number' &&
      stringValue.length < config.minLength
    ) {
      return {
        isValid: false,
        message:
          config.message ?? `Must be at least ${config.minLength} characters`,
      };
    }

    if (
      typeof config.maxLength === 'number' &&
      stringValue.length > config.maxLength
    ) {
      return {
        isValid: false,
        message:
          config.message ?? `Must be at most ${config.maxLength} characters`,
      };
    }

    if (typeof config.pattern === 'string') {
      const regex = new RegExp(config.pattern);
      if (!regex.test(stringValue)) {
        return { isValid: false, message: config.message ?? 'Invalid format' };
      }
    }

    return { isValid: true };
  }

  validateWithRule(ruleName: string, value: unknown): SimpleValidationResult {
    if (!this.config) return { isValid: true };
    const rule = this.config.rules[ruleName];
    if (!rule) return { isValid: true };

    const isRequired = rule.required === true;
    if (isRequired && (value == null || String(value).trim().length === 0)) {
      return { isValid: false, message: rule.message };
    }

    if (value == null || String(value).trim().length === 0) {
      return { isValid: true };
    }

    const stringValue = String(value);

    if (
      typeof rule.minLength === 'number' &&
      stringValue.length < rule.minLength
    ) {
      return { isValid: false, message: rule.message };
    }

    if (typeof rule.pattern === 'string') {
      const regex = new RegExp(rule.pattern);
      if (!regex.test(stringValue)) {
        return { isValid: false, message: rule.message };
      }
    }

    return { isValid: true };
  }

  validateCrossField(
    ruleName: string,
    formData: Record<string, unknown>,
  ): SimpleValidationResult {
    if (!this.config) return { isValid: true };
    const rule = this.config.crossField[ruleName];
    if (!rule) return { isValid: true };

    switch (rule.rule) {
      case 'equal': {
        if (rule.fields.length >= 2) {
          const value1 = formData[rule.fields[0]];
          const value2 = formData[rule.fields[1]];
          if (value1 !== value2) {
            return { isValid: false, message: rule.message };
          }
        }
        break;
      }
      default:
        break;
    }

    return { isValid: true };
  }

  validateForm(
    fieldConfigs: Record<string, ValidationConfig>,
    formData: Record<string, unknown>,
  ): Record<string, SimpleValidationResult> {
    const results: Record<string, SimpleValidationResult> = {};
    for (const [fieldName, config] of Object.entries(fieldConfigs)) {
      const value = formData[fieldName];
      results[fieldName] = this.validateField(fieldName, value, config);
    }
    return results;
  }

  private isValidEmail(email: string): boolean {
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
  }
}
