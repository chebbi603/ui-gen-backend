import { Injectable } from '@nestjs/common';
import { ContractValidator } from '../validation/contract-validator';

/**
 * ContractRepairService applies deterministic fixes to make a contract JSON valid.
 * It focuses on structure-level compliance: required sections, shapes, and types.
 */
@Injectable()
export class ContractRepairService {
  private readonly defaultThresholds: Record<string, number> = {
    rageThreshold: 3,
    rageWindowMs: 1000,
    repeatThreshold: 3,
    repeatWindowMs: 2000,
    formRepeatWindowMs: 10000,
    formFailWindowMs: 10000,
  };

  /**
   * Attempts to repair the contract JSON enough to pass validation.
   * Returns a new object (does not mutate input).
   */
  repair(
    input: Record<string, any>,
    opts?: { base?: Record<string, any> },
  ): Record<string, any> {
    const base = opts?.base || {};
    const out: Record<string, any> = JSON.parse(JSON.stringify(input || {}));

    // Ensure top-level shape
    if (typeof out.version !== 'string' || !out.version.trim()) {
      out.version = String((input as any)?.version || '0.1.0');
    }
    if (!out.meta || typeof out.meta !== 'object') out.meta = {};
    // Always produce a full object (no partial flag)
    if (out.meta && typeof out.meta === 'object') {
      delete out.meta.isPartial;
      // Keep existing optimizationExplanation; diff service will enhance later
      if (typeof out.meta.optimizationExplanation !== 'string') {
        out.meta.optimizationExplanation = '';
      }
    }

    // Thresholds
    if (!out.thresholds || typeof out.thresholds !== 'object') {
      out.thresholds = { ...this.defaultThresholds };
    } else {
      // Coerce numeric values and fill defaults
      Object.keys(this.defaultThresholds).forEach((k) => {
        const v = out.thresholds[k];
        const num = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
        out.thresholds[k] = Number.isFinite(num)
          ? num
          : this.defaultThresholds[k];
      });
    }

    // pagesUI shape
    const pagesFrom = (out as any)?.pagesUI?.pages || (base as any)?.pagesUI?.pages || {};
    if (!out.pagesUI || typeof out.pagesUI !== 'object') {
      out.pagesUI = { pages: {} };
    }
    if (!out.pagesUI.pages || typeof out.pagesUI.pages !== 'object') {
      out.pagesUI.pages = {};
    }

    // If pages is empty but base has authenticated/private pages, copy them
    if (Object.keys(out.pagesUI.pages || {}).length === 0) {
      const basePages: Record<string, any> = pagesFrom || {};
      Object.entries(basePages).forEach(([name, page]) => {
        const scope = String(
          ((page as any)?.meta?.scope ?? (page as any)?.scope ?? '') || '',
        ).toLowerCase();
        if (scope === 'authenticated' || scope === 'private') {
          (out.pagesUI.pages as any)[name] = page;
        }
      });
    }

    // Remove unknown top-level properties to satisfy additionalProperties
    Object.keys(out).forEach((k) => {
      if (!['version', 'meta', 'pagesUI', 'thresholds'].includes(k)) {
        delete (out as any)[k];
      }
    });

    // Run validator; if still invalid and no pages, ensure empty object is present
    const res = new ContractValidator().validateContract(out);
    if (!res.isValid) {
      const hasPages = out.pagesUI && out.pagesUI.pages && typeof out.pagesUI.pages === 'object';
      if (!hasPages) {
        out.pagesUI = { pages: {} };
      }
    }

    return out;
  }
}