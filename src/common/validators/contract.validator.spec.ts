import { validateContractJson } from './contract.validator';

describe('validateContractJson (wrapper)', () => {
  it('returns invalid for missing required sections', () => {
    const res = validateContractJson({});
    expect(res.valid).toBe(false);
    expect(res.errors).toBeDefined();
    expect(
      res.errors?.some((m) =>
        m.includes('meta: Required section missing or invalid'),
      ),
    ).toBe(true);
    expect(
      res.errors?.some((m) =>
        m.includes('pagesUI: Required section missing or invalid'),
      ),
    ).toBe(true);
  });

  it('returns valid for minimal valid contract', () => {
    const res = validateContractJson({ meta: {}, pagesUI: { pages: {} } });
    expect(res.valid).toBe(true);
    expect(res.errors).toBeUndefined();
  });
});
