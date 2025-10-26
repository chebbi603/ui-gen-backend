export type ContractValidationResult = { valid: boolean; errors?: string[] };

export function validateContractJson(json: any): ContractValidationResult {
  const errors: string[] = [];
  if (!json || typeof json !== 'object') {
    return { valid: false, errors: ['contract json must be an object'] };
  }
  if (!Array.isArray(json.screens)) {
    errors.push('json.screens must be an array');
  } else {
    json.screens.forEach((screen: any, i: number) => {
      if (!screen || typeof screen !== 'object') {
        errors.push(`screens[${i}] must be an object`);
      }
      if (!screen.id || typeof screen.id !== 'string') {
        errors.push(`screens[${i}].id must be a string`);
      }
      if (!Array.isArray(screen.components)) {
        errors.push(`screens[${i}].components must be an array`);
      } else {
        screen.components.forEach((comp: any, j: number) => {
          if (!comp || typeof comp !== 'object') {
            errors.push(`screens[${i}].components[${j}] must be an object`);
          }
          if (!comp.id || typeof comp.id !== 'string') {
            errors.push(`screens[${i}].components[${j}].id must be a string`);
          }
          if (!comp.type || typeof comp.type !== 'string') {
            errors.push(`screens[${i}].components[${j}].type must be a string`);
          }
        });
      }
    });
  }
  return { valid: errors.length === 0, errors: errors.length ? errors : undefined };
}