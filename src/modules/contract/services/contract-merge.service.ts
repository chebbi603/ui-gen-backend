import { Injectable, Logger } from '@nestjs/common';

/**
 * Service to merge a canonical/base contract with a partial per-user override.
 * Only pages under `pagesUI.pages` are merged; all other sections are preserved from base.
 */
@Injectable()
export class ContractMergeService {
  private readonly logger = new Logger(ContractMergeService.name);

  /**
   * Merge a complete base contract with a partial contract that contains
   * page-level overrides under `pagesUI.pages`.
   *
   * Rules:
   * - Deep clone `baseContract` first to avoid mutating cached objects.
   * - For each page in `partialContract.pagesUI.pages`:
   *   - If `scope === 'authenticated'`, take the page from partial.
   *   - If `scope === 'public'`, always prefer the page from base.
   *   - Otherwise, prefer base when present; include partial only if base lacks the page.
   * - Preserve all other sections from `baseContract` (meta, dataModels, services, routes, state, themingAccessibility, etc.).
   * - In case of errors, log details and return `baseContract` as a safe fallback.
   */
  mergeContracts(
    baseContract: Record<string, any>,
    partialContract: Record<string, any>,
  ): Record<string, any> {
    try {
      // Deep clone base to avoid mutating cached objects
      const merged = JSON.parse(JSON.stringify(baseContract ?? {}));

      const basePagesUi = (baseContract?.pagesUI ?? {}) as Record<string, any>;
      const basePages = (basePagesUi.pages ?? {}) as Record<string, any>;

      const partialPagesUi = (partialContract?.pagesUI ?? {}) as Record<string, any>;
      const partialPages = (partialPagesUi.pages ?? {}) as Record<string, any>;

      const resultPages: Record<string, any> = {};

      // Union of page IDs from base and partial
      const allPageIds = new Set<string>([
        ...Object.keys(basePages),
        ...Object.keys(partialPages),
      ]);

      for (const pageId of allPageIds) {
        const basePage = basePages[pageId];
        const partialPage = partialPages[pageId];

        if (partialPage) {
          // Scope may be stored as `scope`; support a couple of alternative keys defensively.
          const rawScope =
            partialPage.scope ?? partialPage.meta?.scope ?? partialPage.pageScope;
          const scope = typeof rawScope === 'string' ? rawScope : '';

          if (scope === 'authenticated') {
            // User-specific page; override with partial.
            resultPages[pageId] = partialPage;
          } else if (scope === 'public') {
            // Always prefer base, even if partial provides a version.
            if (basePage != null) {
              resultPages[pageId] = basePage;
            } // else: ignore partial 'public' page if base doesn't define it
          } else {
            // Unknown/missing scope: prefer base when present; otherwise include partial.
            if (basePage != null) {
              resultPages[pageId] = basePage;
            } else {
              resultPages[pageId] = partialPage;
            }
          }
        } else if (basePage) {
          // No partial override; take base as-is.
          resultPages[pageId] = basePage;
        }
      }

      // Write merged pages into the cloned contract
      merged.pagesUI = merged.pagesUI || {};
      merged.pagesUI.pages = resultPages;

      // All other sections remain as in the base contract via deep clone.
      return merged;
    } catch (err) {
      // Log error and provide safe fallback to avoid breaking UX
      const pagesCountBase = Object.keys(
        (baseContract?.pagesUI?.pages ?? {}) as Record<string, any>,
      ).length;
      const pagesCountPartial = Object.keys(
        (partialContract?.pagesUI?.pages ?? {}) as Record<string, any>,
      ).length;

      this.logger.error(
        `Contract merge failed (base pages=${pagesCountBase}, partial pages=${pagesCountPartial})`,
        (err as Error)?.stack ?? String(err),
      );
      try {
        this.logger.error(
          `Base keys: ${Object.keys(baseContract ?? {}).join(',')}`,
        );
        this.logger.error(
          `Partial keys: ${Object.keys(partialContract ?? {}).join(',')}`,
        );
      } catch (_) {
        // swallow logging errors
      }
      return baseContract;
    }
  }
}