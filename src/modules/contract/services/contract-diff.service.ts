import { Injectable } from '@nestjs/common';

@Injectable()
export class ContractDiffService {
  /**
   * Produce a concise human-readable explanation of changes between before and after.
   */
  explainChanges(
    before: Record<string, any>,
    after: Record<string, any>,
  ): string {
    const parts: string[] = [];

    // Version
    if (String(before?.version || '') !== String(after?.version || '')) {
      parts.push(`Version bumped: ${before?.version ?? 'n/a'} → ${after?.version}`);
    }

    // Thresholds differences
    const bt: Record<string, any> = (before as any)?.thresholds || {};
    const at: Record<string, any> = (after as any)?.thresholds || {};
    const tKeys = Array.from(new Set([...Object.keys(bt), ...Object.keys(at)]));
    const tDiffs = tKeys
      .map((k) => ({ k, b: bt[k], a: at[k] }))
      .filter((x) => String(x.b) !== String(x.a))
      .map((x) => `${x.k}: ${x.b ?? 'n/a'} → ${x.a}`);
    if (tDiffs.length) parts.push(`Thresholds updated: ${tDiffs.join(', ')}`);

    // Pages added/removed
    const bp: Record<string, any> = (before as any)?.pagesUI?.pages || {};
    const ap: Record<string, any> = (after as any)?.pagesUI?.pages || {};
    const bNames = new Set(Object.keys(bp || {}));
    const aNames = new Set(Object.keys(ap || {}));
    const added = [...aNames].filter((n) => !bNames.has(n));
    const removed = [...bNames].filter((n) => !aNames.has(n));
    if (added.length) parts.push(`Pages added: ${added.join(', ')}`);
    if (removed.length) parts.push(`Pages removed: ${removed.join(', ')}`);

    // For pages present in both, count elements/components if available
    const common = [...aNames].filter((n) => bNames.has(n));
    common.forEach((name) => {
      const bPage = bp[name] || {};
      const aPage = ap[name] || {};
      const bCount = this.countComponents(bPage);
      const aCount = this.countComponents(aPage);
      if (bCount !== aCount) {
        parts.push(`Page '${name}' components: ${bCount} → ${aCount}`);
      }
    });

    if (!parts.length) return 'Minor sanitization applied; no structural changes.';
    return parts.join(' — ');
  }

  private countComponents(page: any): number {
    // Best-effort: count leaf nodes in page.components array or object
    const compsArr = (page?.components as any[]) || [];
    if (Array.isArray(compsArr) && compsArr.length) return compsArr.length;
    const compsObj = (page?.components as Record<string, any>) || {};
    return Object.keys(compsObj || {}).length;
  }
}