import { Injectable } from '@nestjs/common';
import { SPACING, CARD_DEFAULTS, COLORS } from '../../design/design-system';

export interface DesignValidationIssue { path: string; message: string }
export interface DesignValidationReport { valid: boolean; errors: DesignValidationIssue[]; warnings: DesignValidationIssue[] }

@Injectable()
export class ContractDesignValidatorService {
  validate(contract: Record<string, any>): DesignValidationReport {
    const errors: DesignValidationIssue[] = [];
    const warnings: DesignValidationIssue[] = [];

    // Theme tokens defined
    const theme = contract?.themingAccessibility;
    if (!theme || typeof theme !== 'object') {
      errors.push({ path: 'themingAccessibility', message: 'Missing theme tokens' });
    }

    // Pages must have backgroundColor and no direct hex colors in styles
    const pages: Record<string, any> = contract?.pagesUI?.pages || {};
    for (const [pageId, page] of Object.entries(pages)) {
      const style = page?.style ?? {};
      if (!style?.backgroundColor) {
        errors.push({ path: `pagesUI.pages.${pageId}.style.backgroundColor`, message: 'Required backgroundColor missing' });
      }
      this.scanStyleForDirectHex(style, `pagesUI.pages.${pageId}.style`, errors);
      // children checks
      const children: any[] = Array.isArray(page?.children) ? page.children : [];
      for (let i = 0; i < children.length; i++) {
        this.validateComponent(`pagesUI.pages.${pageId}.children[${i}]`, children[i], contract, errors, warnings);
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  private validateComponent(path: string, comp: any, contract: Record<string, any>, errors: DesignValidationIssue[], warnings: DesignValidationIssue[]) {
    if (!comp || typeof comp !== 'object') {
      errors.push({ path, message: 'Component must be object' });
      return;
    }
    const type = comp.type?.toString?.() || '';

    // All textFields must have placeholder
    if (type === 'textField' || type === 'text_field') {
      if (!comp.placeholder) {
        errors.push({ path: `${path}.placeholder`, message: 'textField requires placeholder' });
      }
    }

    // Static lists must disable pagination
    if (type === 'list') {
      if (Array.isArray(comp.data)) {
        const enabled = !!comp?.pagination?.enabled;
        if (enabled) errors.push({ path: `${path}.pagination.enabled`, message: 'Static list must set pagination.enabled = false' });
      }
    }

    // Image URLs must be valid http(s)
    if (type === 'image') {
      if (!/^https?:\/\//.test(comp.url || '')) {
        errors.push({ path: `${path}.url`, message: 'Image url must be http(s)' });
      }
    }

    // Spacing must follow constants
    if (comp.style) {
      this.scanStyleForDirectHex(comp.style, `${path}.style`, errors);
      this.validateSpacing(comp.style, `${path}.style`, errors, warnings);
    }

    // Cards follow default pattern (warn if deviating)
    if (type === 'card') {
      const br = comp?.style?.borderRadius;
      const pad = comp?.style?.padding?.all ?? comp?.style?.padding;
      if (typeof br === 'number' && br !== CARD_DEFAULTS.borderRadius) {
        warnings.push({ path: `${path}.style.borderRadius`, message: `Non-standard borderRadius; expected ${CARD_DEFAULTS.borderRadius}` });
      }
      if (typeof pad === 'number' && !this.isValidSpacingValue(pad)) {
        warnings.push({ path: `${path}.style.padding`, message: 'Padding should use SPACING constants' });
      }
    }

    // Theme token references must exist
    this.validateThemeTokens(comp, path, contract, errors);

    // Recurse children
    if (Array.isArray(comp.children)) {
      for (let i = 0; i < comp.children.length; i++) {
        this.validateComponent(`${path}.children[${i}]`, comp.children[i], contract, errors, warnings);
      }
    }

    if (typeof comp.itemBuilder === 'object') {
      this.validateComponent(`${path}.itemBuilder`, comp.itemBuilder, contract, errors, warnings);
    }
  }

  private validateThemeTokens(obj: any, path: string, contract: Record<string, any>, errors: DesignValidationIssue[]) {
    const theme = contract?.themingAccessibility || {};
    const checkStr = (s: string) => {
      const m = s.match(/^\$\{theme\.(.+)\}$/);
      if (m) {
        const token = m[1];
        const exists = !!(theme?.light?.[token] || theme?.dark?.[token]);
        if (!exists) errors.push({ path, message: `Unknown theme token: ${token}` });
      }
    };
    const scan = (val: any, p: string) => {
      if (typeof val === 'string') checkStr(val);
      else if (typeof val === 'object' && val) {
        for (const [k, v] of Object.entries(val)) scan(v, `${p}.${k}`);
      }
    };
    scan(obj, path);
  }

  private scanStyleForDirectHex(style: Record<string, any>, path: string, errors: DesignValidationIssue[]) {
    for (const [k, v] of Object.entries(style || {})) {
      if (typeof v === 'string' && /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/.test(v)) {
        errors.push({ path: `${path}.${k}`, message: 'Direct hex color not allowed; use ${theme.*} tokens' });
      }
    }
  }

  private validateSpacing(style: Record<string, any>, path: string, errors: DesignValidationIssue[], warnings: DesignValidationIssue[]) {
    const margin = style?.margin;
    const padding = style?.padding;
    const check = (val: any, keyPath: string) => {
      if (typeof val === 'number' && !this.isValidSpacingValue(val)) {
        warnings.push({ path: keyPath, message: 'Spacing should use SPACING constants' });
      }
      if (typeof val === 'object' && val) {
        for (const [k, v] of Object.entries(val)) check(v, `${keyPath}.${k}`);
      }
    };
    if (margin) check(margin, `${path}.margin`);
    if (padding) check(padding, `${path}.padding`);
  }

  private isValidSpacingValue(val: number): boolean {
    const spacingValues = Object.values(SPACING) as number[];
    return spacingValues.includes(val);
  }
}