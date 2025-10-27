import { ContractValidationService } from './contract-validation.service';

describe('ContractValidationService', () => {
  let service: ContractValidationService;

  beforeEach(() => {
    service = new ContractValidationService();
  });

  it('validate returns structured errors for missing sections', () => {
    const result = service.validate({});
    expect(result.isValid).toBe(false);
    const paths = result.errors.map((e) => e.path);
    expect(paths).toContain('meta');
    expect(paths).toContain('pagesUI');
    expect(result.stats.pages).toBe(0);
  });

  it('validateSimple returns { valid, errors } format', () => {
    const simple = service.validateSimple({});
    expect(simple.valid).toBe(false);
    expect(simple.errors).toBeDefined();
    expect(simple?.errors?.some((m) => m.startsWith('meta:'))).toBe(true);
    expect(simple?.errors?.some((m) => m.startsWith('pagesUI:'))).toBe(true);
  });
});
