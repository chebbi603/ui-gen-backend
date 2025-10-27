import { ContractValidator } from './contract-validator';

describe('ContractValidator', () => {
  it('returns invalid when required sections are missing', () => {
    const result = new ContractValidator().validateContract({});
    expect(result.isValid).toBe(false);
    const paths = result.errors.map((e) => e.path);
    expect(paths).toContain('meta');
    expect(paths).toContain('pagesUI');
  });

  it('validates action required parameters (apiCall)', () => {
    const contract: any = {
      meta: {},
      pagesUI: {
        pages: {
          home: {
            children: [
              {
                type: 'button',
                onTap: { action: 'apiCall' }, // missing service and endpoint
              },
            ],
          },
        },
      },
    };
    const result = new ContractValidator().validateContract(contract);
    expect(result.isValid).toBe(false);
    expect(
      result.errors.some(
        (e) =>
          e.path.endsWith('.onTap') &&
          /apiCall requires service and endpoint/.test(e.message),
      ),
    ).toBe(true);
  });

  it('flags routes referencing unknown pages', () => {
    const contract: any = {
      meta: {},
      pagesUI: {
        pages: { home: { children: [] } },
        routes: { '/bad': { pageId: 'missing' } },
      },
    };
    const result = new ContractValidator().validateContract(contract);
    expect(result.isValid).toBe(false);
    expect(
      result.errors.some(
        (e) =>
          e.path === 'pagesUI.routes./bad' &&
          /pageId not found/.test(e.message),
      ),
    ).toBe(true);
  });

  it('validates services response schema data property', () => {
    const contract: any = {
      meta: {},
      pagesUI: { pages: {} },
      services: {
        user: {
          endpoints: {
            get: {
              responseSchema: { type: 'object', properties: {} }, // missing data property
            },
          },
        },
      },
    };
    const result = new ContractValidator().validateContract(contract);
    expect(result.isValid).toBe(false);
    expect(
      result.errors.some(
        (e) =>
          e.path.includes(
            'services.user.endpoints.get.responseSchema.properties',
          ) && /Missing required data property/.test(e.message),
      ),
    ).toBe(true);
  });
});
