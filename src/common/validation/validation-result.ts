export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationWarning {
  path: string;
  message: string;
}

export interface ValidationStats {
  components: number;
  actions: number;
  pages: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  stats: ValidationStats;
}

// Lightweight field-level result used by EnhancedValidator
export interface SimpleValidationResult {
  isValid: boolean;
  message?: string;
}

export function makeEmptyStats(): ValidationStats {
  return { components: 0, actions: 0, pages: 0 };
}
