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
    expect(
      res.errors?.some((m) =>
        m.includes('version: Required section missing or invalid'),
      ),
    ).toBe(true);
    expect(
      res.errors?.some((m) =>
        m.includes('thresholds: Required section missing or invalid'),
      ),
    ).toBe(true);
  });

  it('returns valid for minimal valid contract', () => {
    const res = validateContractJson({ version: '0.1.0', meta: {}, pagesUI: { pages: {} }, thresholds: { rageThreshold: 3 } });
    expect(res.valid).toBe(true);
    expect(res.errors).toBeUndefined();
  });
});
