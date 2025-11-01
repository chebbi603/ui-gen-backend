import { Injectable } from '@nestjs/common';
import {
  SPACING,
  ELEVATION,
  CARD_DEFAULTS,
  COLORS,
  resolveThemeToken,
  GRID_COLUMNS,
  LIST_ITEM_HEIGHT,
} from '../../design/design-system';

type LayoutType = 'scroll' | 'center';

export interface ValidationReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface BuilderOptions {
  themeMode?: keyof typeof COLORS;
}

/**
 * ContractBuilderService produces UX-compliant canonical contracts using a design system.
 * Methods are chainable where feasible. Call build() to get final JSON.
 */
@Injectable()
export class ContractBuilderService {
  private contract: Record<string, any> = {};
  private currentPageId: string | null = null;
  private componentIndex: Record<string, Record<string, any>> = {};
  private options: BuilderOptions = { themeMode: 'light' };

  startContract(
    appName: string,
    version: string,
    themeTokens?: Record<string, string>,
    dataModels?: Record<string, any>,
    options?: BuilderOptions,
  ): this {
    this.options = { ...this.options, ...(options || {}) };
    const theme = themeTokens && Object.keys(themeTokens).length > 0
      ? { light: { ...COLORS.light, ...themeTokens }, dark: COLORS.dark }
      : COLORS;

    this.contract = {
      meta: {
        appName,
        version,
        schemaVersion: '2.0.0',
        generatedAt: new Date().toISOString(),
      },
      dataModels: dataModels ?? {
        User: {
          primaryKey: 'id',
          fields: {
            id: { type: 'string', required: true },
            email: { type: 'string', format: 'email', required: true },
            name: { type: 'string', required: true },
          },
        },
      },
      services: [
        {
          name: 'AuthService',
          baseUrl: 'http://localhost:8081/auth',
          endpoints: [
            {
              name: 'login',
              method: 'POST',
              path: '/login',
              authRequired: false,
              params: {
                email: { type: 'string', format: 'email', required: true },
                password: { type: 'string', required: true },
              },
            },
          ],
        },
      ],
      pagesUI: {
        routes: {},
        bottomNavigation: {
          enabled: true,
          authRequired: true,
          items: [],
        },
        pages: {},
      },
      state: {
        global: {
          authToken: { type: 'string', persistence: 'secure' },
          selectedCategory: { type: 'string', persistence: 'session' },
        },
        pages: {},
      },
      themingAccessibility: theme,
    };
    return this;
  }

  /** Create a page and mark as current page for subsequent additions */
  createPage(id: string, title: string, layout: LayoutType, authRequired: boolean): this {
    const pages = this.contract.pagesUI.pages as Record<string, any>;
    pages[id] = {
      id,
      title,
      scope: authRequired ? 'authenticated' : 'public',
      layout,
      style: { backgroundColor: '${theme.background}' },
      children: [],
    };
    // register route
    const routes = this.contract.pagesUI.routes as Record<string, any>;
    const routePath = this.inferRouteFromPageId(id);
    routes[routePath] = { pageId: id, auth: authRequired, description: `${authRequired ? 'Protected' : 'Public'} ${title}` };

    // bottom navigation for protected pages
    if (authRequired) {
      const bn = this.contract.pagesUI.bottomNavigation;
      bn.items.push({ label: title, icon: this.iconForPage(id), route: routePath });
    }

    // Init state map for page
    (this.contract.state.pages as Record<string, any>)[id] = {};

    this.currentPageId = id;
    return this;
  }

  addCard(title?: string, children?: any[], elevation?: keyof typeof ELEVATION, padding?: number): this {
    const page = this.requireCurrentPage();
    const card: Record<string, any> = {
      type: 'card',
      style: {
        backgroundColor: '${theme.surface}',
        padding: { all: padding ?? CARD_DEFAULTS.padding },
        borderRadius: CARD_DEFAULTS.borderRadius,
        elevation: elevation ? ELEVATION[elevation] : CARD_DEFAULTS.elevation,
        margin: { bottom: SPACING.md },
      },
      children: [],
    };
    if (title) {
      card.children.push({
        type: 'text',
        text: title,
        style: { color: '${theme.onSurface}', fontSize: 18, fontWeight: '600', margin: { bottom: SPACING.sm } },
      });
    }
    if (children && Array.isArray(children)) card.children.push(...children);
    page.children.push(card);
    return this;
  }

  addList(id: string, staticDataArray?: any[], paginationEnabled: boolean = true): this {
    const page = this.requireCurrentPage();
    const comp: Record<string, any> = {
      id,
      type: 'list',
      itemHeight: SPACING.md + LIST_ITEM_HEIGHT - SPACING.md, // ensure presence
      style: { margin: { top: SPACING.md } },
      pagination: { enabled: staticDataArray ? false : paginationEnabled },
    };
    if (staticDataArray) {
      comp.data = staticDataArray;
      comp.itemBuilder = {
        type: 'row',
        children: [
          { type: 'image', width: 64, height: 64, url: 'https://picsum.photos/seed/item/64/64', style: { margin: { right: SPACING.sm } } },
          { type: 'column', children: [
            { type: 'text', text: '${item.title}', style: { color: '${theme.onSurface}', fontSize: 16 } },
            { type: 'text', text: '${item.subtitle}', style: { color: '${theme.onSurface}', fontSize: 12 } },
          ]},
        ],
      };
    }
    page.children.push(comp);
    this.componentIndex[id] = comp;
    return this;
  }

  applyTheme(tokenName: string): string | null {
    return resolveThemeToken(`\${theme.${tokenName}}`, this.options.themeMode);
  }

  addImage(seedOrUrl: string, width: number = 300, height: number = 200): this {
    const page = this.requireCurrentPage();
    const isUrl = /^https?:\/\//.test(seedOrUrl);
    const url = isUrl
      ? seedOrUrl
      : `https://picsum.photos/seed/${encodeURIComponent(seedOrUrl)}/${width}/${height}`;
    const comp = { type: 'image', url, width, height, style: { borderRadius: 8 } };
    page.children.push(comp);
    return this;
  }

  addBinding(stateKey: string, componentIds: string[]): this {
    // verify state key exists
    const sGlobal = this.contract.state.global as Record<string, any>;
    const sPage = (this.currentPageId ? (this.contract.state.pages[this.currentPageId] as Record<string, any>) : {}) || {};
    const exists = Object.prototype.hasOwnProperty.call(sGlobal, stateKey) || Object.prototype.hasOwnProperty.call(sPage, stateKey);
    if (!exists) {
      // auto-create under page scope
      if (this.currentPageId) {
        (this.contract.state.pages[this.currentPageId] as Record<string, any>)[stateKey] = { type: 'string', persistence: 'memory' };
      } else {
        sGlobal[stateKey] = { type: 'string', persistence: 'memory' };
      }
    }
    // attach binding on components
    for (const id of componentIds) {
      const comp = this.componentIndex[id];
      if (!comp) continue;
      comp.binding = `\${state.${stateKey}}`;
      comp.dependencies = Array.isArray(comp.dependencies) ? comp.dependencies : [];
      if (!comp.dependencies.includes(stateKey)) comp.dependencies.push(stateKey);
    }
    return this;
  }

  validate(): ValidationReport {
    const errors: string[] = [];
    const warnings: string[] = [];
    // Basic checks on theme tokens used
    const pages = this.contract?.pagesUI?.pages || {};
    for (const [id, page] of Object.entries(pages as Record<string, any>)) {
      const bg = page?.style?.backgroundColor;
      if (!bg) errors.push(`pagesUI.pages.${id}.style.backgroundColor: Missing required backgroundColor`);
      if (typeof bg === 'string' && /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/.test(bg)) {
        errors.push(`pagesUI.pages.${id}.style.backgroundColor: Direct hex color not allowed`);
      }
    }
    return { valid: errors.length === 0, errors, warnings };
  }

  build(): Record<string, any> {
    return this.contract;
  }

  // Helpers
  private inferRouteFromPageId(id: string): string {
    switch (id) {
      case 'landing':
        return '/';
      case 'login':
        return '/login';
      case 'home':
        return '/home';
      default:
        return `/content/${id}`;
    }
  }

  private iconForPage(id: string): string {
    switch (id) {
      case 'home':
        return 'home';
      case 'music':
        return 'library_music';
      case 'podcasts':
        return 'mic';
      case 'ebooks':
        return 'book';
      default:
        return 'dashboard';
    }
  }

  private requireCurrentPage(): Record<string, any> {
    if (!this.currentPageId) throw new Error('No current page. Call createPage() first.');
    const page = (this.contract.pagesUI.pages as Record<string, any>)[this.currentPageId];
    if (!page) throw new Error(`Current page '${this.currentPageId}' missing.`);
    return page;
  }
}