import { ContractMergeService } from './contract-merge.service';

describe('ContractMergeService', () => {
  let service: ContractMergeService;

  const makeCanonical = () => ({
    meta: { appName: 'Demo', versionTag: 'canon-1' },
    dataModels: { user: { fields: ['id', 'name'] } },
    services: { user: { endpoints: { get: { responseSchema: { type: 'object', properties: { data: { $ref: '#/dataModels/user' } } } } } } },
    routes: { '/home': { pageId: 'home' }, '/authA': { pageId: 'authA' } },
    state: { global: { theme: { type: 'string' } } },
    themingAccessibility: { contrast: 'AA' },
    pagesUI: {
      pages: {
        home: { scope: 'public', title: 'Home (canonical)' },
        about: { scope: 'public', title: 'About (canonical)' },
        contact: { scope: 'public', title: 'Contact (canonical)' },
        authA: { scope: 'authenticated', title: 'AuthA (canonical)' },
        authB: { scope: 'authenticated', title: 'AuthB (canonical)' },
        authC: { scope: 'authenticated', title: 'AuthC (canonical)' },
      },
    },
  });

  const makePartialAllAuth = () => ({
    pagesUI: {
      pages: {
        authA: { scope: 'authenticated', title: 'AuthA (personalized)' },
        authB: { scope: 'authenticated', title: 'AuthB (personalized)' },
        authC: { scope: 'authenticated', title: 'AuthC (personalized)' },
      },
    },
  });

  beforeEach(() => {
    service = new ContractMergeService();
  });

  it('should successfully merge base and partial contracts', () => {
    const canonical = makeCanonical();
    const partial = makePartialAllAuth();
    const result = service.mergeContracts(canonical, partial);

    // All six pages present
    const pages = result.pagesUI?.pages ?? {};
    expect(Object.keys(pages).sort()).toEqual(
      ['about', 'authA', 'authB', 'authC', 'contact', 'home'].sort(),
    );

    // Public pages come from canonical
    expect(pages.home.title).toBe('Home (canonical)');
    expect(pages.about.title).toBe('About (canonical)');
    expect(pages.contact.title).toBe('Contact (canonical)');

    // Auth pages come from partial
    expect(pages.authA.title).toBe('AuthA (personalized)');
    expect(pages.authB.title).toBe('AuthB (personalized)');
    expect(pages.authC.title).toBe('AuthC (personalized)');

    // Top-level sections match canonical
    expect(result.meta).toEqual(canonical.meta);
    expect(result.dataModels).toEqual(canonical.dataModels);
    expect(result.services).toEqual(canonical.services);
    expect(result.routes).toEqual(canonical.routes);
    expect(result.state).toEqual(canonical.state);
    expect(result.themingAccessibility).toEqual(
      canonical.themingAccessibility,
    );
  });

  it('should handle missing authenticated pages in partial', () => {
    const canonical = makeCanonical();
    const partial = {
      pagesUI: { pages: { authA: { scope: 'authenticated', title: 'AuthA (personalized)' } } },
    };
    const result = service.mergeContracts(canonical, partial);
    const pages = result.pagesUI?.pages ?? {};

    // Provided partial page overrides; others fall back to canonical
    expect(pages.authA.title).toBe('AuthA (personalized)');
    expect(pages.authB.title).toBe('AuthB (canonical)');
    expect(pages.authC.title).toBe('AuthC (canonical)');
  });

  it('should ignore public pages in partial contract', () => {
    const canonical = makeCanonical();
    const partial = {
      pagesUI: {
        pages: {
          home: { scope: 'public', title: 'Home (partial wrong)' },
          about: { scope: 'public', title: 'About (partial wrong)' },
          authA: { scope: 'authenticated', title: 'AuthA (personalized)' },
        },
      },
    };
    const result = service.mergeContracts(canonical, partial);
    const pages = result.pagesUI?.pages ?? {};

    // Public pages remain canonical even if partial provided
    expect(pages.home.title).toBe('Home (canonical)');
    expect(pages.about.title).toBe('About (canonical)');
    // Auth page overrides correctly
    expect(pages.authA.title).toBe('AuthA (personalized)');
  });

  it('should not mutate original base contract', () => {
    const canonical = makeCanonical();
    const canonicalSnapshot = JSON.parse(JSON.stringify(canonical));
    const partial = makePartialAllAuth();
    const _result = service.mergeContracts(canonical, partial);
    // Base remains unchanged
    expect(canonical).toEqual(canonicalSnapshot);
  });

  it('should complete merge quickly', () => {
    const canonical = makeCanonical();
    const partial = makePartialAllAuth();
    const start = Date.now();
    const _result = service.mergeContracts(canonical, partial);
    const durationMs = Date.now() - start;
    expect(durationMs).toBeLessThan(50);
  });
});