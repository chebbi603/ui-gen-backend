import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class FlutterContractFilterService {
  private readonly logger = new Logger(FlutterContractFilterService.name);

  private readonly allowedTypes = new Set<string>([
    'text',
    'textField',
    'text_field',
    'button',
    'textButton',
    'icon',
    'iconButton',
    'image',
    'card',
    'list',
    'grid',
    'row',
    'column',
    'center',
    'hero',
    'form',
    'searchBar',
    'chip',
    'progressIndicator',
    'switch',
    'slider',
    'audio',
    'video',
    'webview',
  ]);

  filterForFlutter(json: Record<string, any>): Record<string, any> {
    try {
      const clone = JSON.parse(JSON.stringify(json));
      if (!clone || typeof clone !== 'object') return json;

      if (clone.pagesUI && typeof clone.pagesUI === 'object') {
        clone.pagesUI = this.filterPagesUI(clone.pagesUI);
      }
      return clone;
    } catch (err) {
      this.logger.warn(`Filter failed; returning original contract: ${err}`);
      return json;
    }
  }

  private filterPagesUI(pagesUi: Record<string, any>): Record<string, any> {
    const filtered: Record<string, any> = { ...pagesUi };
    for (const [key, value] of Object.entries(pagesUi)) {
      if (value && typeof value === 'object') {
        if (this.looksLikePage(value)) {
          filtered[key] = this.filterPage(value);
        }
      }
    }
    return filtered;
  }

  private looksLikePage(obj: any): boolean {
    return (
      typeof obj === 'object' && (
        Array.isArray(obj?.children) ||
        typeof obj?.layout === 'string' ||
        typeof obj?.title === 'string' ||
        typeof obj?.id === 'string'
      )
    );
  }

  private filterPage(page: any): any {
    const p = { ...page };
    if (Array.isArray(p.children)) {
      p.children = this.normalizeChildren(p.children);
    }
    return p;
  }

  private normalizeChildren(children: any[]): any[] {
    const result: any[] = [];
    for (const ch of children) {
      const normalized = this.normalizeComponent(ch);
      if (Array.isArray(normalized)) {
        result.push(...normalized);
      } else if (normalized) {
        result.push(normalized);
      }
    }
    return result;
  }

  private normalizeComponent(comp: any): any | any[] | null {
    if (
      typeof comp === 'string' ||
      typeof comp === 'number' ||
      typeof comp === 'boolean'
    ) {
      return { type: 'text', text: String(comp) };
    }
    if (!comp || typeof comp !== 'object') return null;

    const rawType = (comp.type ?? '').toString();
    const type = this.normalizeType(rawType);
    if (!this.isAllowed(type)) {
      if (rawType === 'progressBar') {
        return { type: 'progressIndicator' };
      }
      if (Array.isArray(comp.children)) {
        return this.normalizeChildren(comp.children);
      }
      return null;
    }

    const out: any = { ...comp, type };
    if (type === 'textField') {
      if (out.binding == null && out.key != null) {
        out.binding = out.key;
      }
      delete out.key;
      if (out.keyboardType == null && out.keyboard != null) {
        out.keyboardType = out.keyboard;
      }
      delete out.keyboard;
      if (out.obscureText == null && out.obscure != null) {
        out.obscureText = !!out.obscure;
      }
      delete out.obscure;
    }
    if (type === 'searchBar') {
      if (out.onChanged == null && out.action) {
        out.onChanged = out.action;
        delete out.action;
      }
    }
    if (type === 'list') {
      if (out.itemBuilder == null && out.itemTemplate) {
        out.itemBuilder = this.normalizeComponent(out.itemTemplate) ?? null;
        delete out.itemTemplate;
      } else if (out.itemBuilder) {
        out.itemBuilder = this.normalizeComponent(out.itemBuilder);
      }
    }
    if (type === 'grid') {
      if (out.dataSource && out.itemTemplate) {
        out.type = 'list';
        out.itemBuilder = this.normalizeComponent(out.itemTemplate);
        delete out.itemTemplate;
      } else if (Array.isArray(out.children)) {
        out.children = this.normalizeChildren(out.children);
      }
    }
    if (Array.isArray(out.children)) {
      out.children = this.normalizeChildren(out.children);
    }
    return out;
  }

  private normalizeType(type: string): string {
    const lower = type.toLowerCase();
    if (lower === 'text_field') return 'textField';
    if (lower === 'progressbar') return 'progressIndicator';
    return type;
  }

  private isAllowed(type: string): boolean {
    return this.allowedTypes.has(type);
  }
}
