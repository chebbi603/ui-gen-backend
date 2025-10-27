import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ValidationStats,
  makeEmptyStats,
} from '../../../common/validation/validation-result';

/**
 * Validates canonical JSON contracts against supported features extracted from docs.
 * Checks components, actions, services schemas, state configuration, and cross-references
 * (routes, endpoints, icons, bindings), returning structured errors/warnings and basic stats.
 */
export class ContractValidator {
  // Fallback constants; doc-derived lists override when available.
  private static readonly supportedStateScopes = [
    'global',
    'page',
    'session',
    'memory',
  ];
  private static readonly supportedPersistence = [
    'local',
    'secure',
    'session',
    'memory',
  ];

  static get supportedComponents(): string[] {
    return DocFeatures.instance.components.length > 0
      ? DocFeatures.instance.components
      : [
          'text',
          'textField',
          'text_field',
          'button',
          'textButton',
          'iconButton',
          'icon',
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
          'filterChips',
          'chip',
          'progressIndicator',
          'switch',
          'slider',
          'audio',
          'video',
          'webview',
        ];
  }

  static get supportedActions(): string[] {
    return DocFeatures.instance.actions.length > 0
      ? DocFeatures.instance.actions
      : [
          'navigate',
          'pop',
          'openUrl',
          'apiCall',
          'updateState',
          'showError',
          'showSuccess',
          'submitForm',
          'refreshData',
          'showBottomSheet',
          'showDialog',
          'clearCache',
          'undo',
          'redo',
        ];
  }

  static get supportedValidations(): string[] {
    return DocFeatures.instance.validations.length > 0
      ? DocFeatures.instance.validations
      : [
          'required',
          'email',
          'minLength',
          'maxLength',
          'pattern',
          'message',
          'equal',
        ];
  }

  /** Backward-compatible static entry that returns error messages. */
  static validate(contract: Record<string, unknown>): string[] {
    const result = new ContractValidator().validateContract(contract);
    return result.errors.map((e) => `${e.path}: ${e.message}`);
  }

  /** Main entry point. */
  validateContract(contract: Record<string, any>): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const stats: ValidationStats = makeEmptyStats();

    // Required sections
    if (typeof contract.meta !== 'object' || contract.meta == null) {
      errors.push({
        path: 'meta',
        message: 'Required section missing or invalid',
      });
    }
    if (typeof contract.pagesUI !== 'object' || contract.pagesUI == null) {
      errors.push({
        path: 'pagesUI',
        message: 'Required section missing or invalid',
      });
    }

    // Components/pages
    const pagesUi = contract.pagesUI as Record<string, any> | undefined;
    if (pagesUi) {
      const pages = (pagesUi.pages ?? {}) as Record<string, any>;
      stats.pages = Object.keys(pages).length;
      for (const [pageId, page] of Object.entries(pages)) {
        this.validatePage(
          pageId,
          page as Record<string, any>,
          errors,
          warnings,
          stats,
          contract,
        );
      }
      // routes cross-refs
      this.validateRoutes(pagesUi, errors);
    }

    // Actions top-level (eventsActions)
    if (typeof contract.eventsActions === 'object' && contract.eventsActions) {
      this.validateTopLevelActions(
        contract.eventsActions as Record<string, any>,
        errors,
        warnings,
        stats,
        contract,
      );
    }

    // Services
    if (typeof contract.services === 'object' && contract.services) {
      this.validateServices(contract, errors, warnings);
    }

    // State
    if (typeof contract.state === 'object' && contract.state) {
      this.validateState(
        contract.state as Record<string, any>,
        errors,
        warnings,
      );
    }

    // Cross references (icons, service endpoints in actions)
    this.validateCrossReferences(contract, errors, warnings);

    return { isValid: errors.length === 0, errors, warnings, stats };
  }

  private validatePage(
    pageId: string,
    page: Record<string, any>,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    stats: ValidationStats,
    contract: Record<string, any>,
  ) {
    const children = (page.children ?? []) as any[];
    for (let i = 0; i < children.length; i++) {
      const comp = children[i];
      this.validateComponent(
        `pagesUI.pages.${pageId}.children[${i}]`,
        comp,
        errors,
        warnings,
        stats,
        contract,
      );
    }
  }

  private validateComponent(
    path: string,
    comp: any,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    stats: ValidationStats,
    contract: Record<string, any>,
  ) {
    if (typeof comp !== 'object' || comp == null) {
      errors.push({ path, message: 'Component must be an object' });
      return;
    }
    stats.components++;

    const type = comp.type?.toString();
    if (!type || !ContractValidator.supportedComponents.includes(type)) {
      errors.push({
        path: `${path}.type`,
        message: `Unsupported component type: ${type}`,
      });
    }

    // Validate bindings
    if (Object.prototype.hasOwnProperty.call(comp, 'binding')) {
      const binding = comp.binding?.toString() ?? '';
      if (this.isStateBinding(binding)) {
        // ok
      } else if (
        this.isItemBinding(binding) ||
        this.looksLikeItemField(binding)
      ) {
        // ok
      } else {
        warnings.push({
          path: `${path}.binding`,
          message: 'Binding format not recognized',
        });
      }
    }

    // Validate inline validation rules
    if (typeof comp.validation === 'object' && comp.validation) {
      const v = comp.validation as Record<string, any>;
      for (const key of Object.keys(v)) {
        if (!ContractValidator.supportedValidations.includes(key)) {
          warnings.push({
            path: `${path}.validation.${key}`,
            message: 'Unknown validation rule',
          });
        }
      }
    }

    // Actions on component
    for (const actionKey of ['onTap', 'onChanged', 'onSubmit']) {
      if (typeof comp[actionKey] === 'object' && comp[actionKey]) {
        this.validateAction(
          `${path}.${actionKey}`,
          comp[actionKey] as Record<string, any>,
          errors,
          warnings,
          stats,
          contract,
        );
      }
    }

    // Recurse children
    if (Array.isArray(comp.children)) {
      const children = comp.children as any[];
      for (let i = 0; i < children.length; i++) {
        this.validateComponent(
          `${path}.children[${i}]`,
          children[i],
          errors,
          warnings,
          stats,
          contract,
        );
      }
    }

    // List itemBuilder
    if (typeof comp.itemBuilder === 'object' && comp.itemBuilder) {
      this.validateComponent(
        `${path}.itemBuilder`,
        comp.itemBuilder,
        errors,
        warnings,
        stats,
        contract,
      );
    }
  }

  private validateTopLevelActions(
    eventsActions: Record<string, any>,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    stats: ValidationStats,
    contract: Record<string, any>,
  ) {
    for (const [key, arr] of Object.entries(eventsActions)) {
      if (Array.isArray(arr)) {
        for (let i = 0; i < arr.length; i++) {
          const act = arr[i];
          if (typeof act === 'object' && act) {
            this.validateAction(
              `eventsActions.${key}[${i}]`,
              act,
              errors,
              warnings,
              stats,
              contract,
            );
          } else {
            errors.push({
              path: `eventsActions.${key}[${i}]`,
              message: 'Action must be an object',
            });
          }
        }
      } else {
        warnings.push({
          path: `eventsActions.${key}`,
          message: 'Expected an array of actions',
        });
      }
    }
  }

  private validateAction(
    path: string,
    action: Record<string, any>,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    stats: ValidationStats,
    contract: Record<string, any>,
  ) {
    stats.actions++;
    const type = action.action?.toString();
    if (!type || !ContractValidator.supportedActions.includes(type)) {
      errors.push({
        path: `${path}.action`,
        message: `Unsupported action type: ${type}`,
      });
      return;
    }

    // Required params per action
    switch (type) {
      case 'navigate': {
        if (action.route == null && action.pageId == null) {
          errors.push({ path, message: 'navigate requires route or pageId' });
        }
        break;
      }
      case 'apiCall': {
        if (action.service == null || action.endpoint == null) {
          errors.push({
            path,
            message: 'apiCall requires service and endpoint',
          });
        }
        break;
      }
      case 'updateState': {
        const params = action.params as Record<string, any> | undefined;
        if (!params || params.key == null) {
          errors.push({ path, message: 'updateState requires params.key' });
        }
        break;
      }
      case 'submitForm': {
        if (
          action.formId == null &&
          action.params?.formId == null &&
          action.pageId == null
        ) {
          warnings.push({
            path,
            message: 'submitForm missing formId or pageId',
          });
        }
        break;
      }
      default:
        break;
    }

    // Template resolution keys
    if (Object.prototype.hasOwnProperty.call(action, 'params')) {
      const params = action.params;
      if (typeof params === 'object' && params) {
        for (const [k, v] of Object.entries(params)) {
          if (typeof v === 'string' && !v.includes('\n')) {
            if (v.includes('\u0000')) continue;
            if (this.looksLikeTemplate(v) && !this.isStateTemplate(v)) {
              warnings.push({
                path: `${path}.params.${k}`,
                message: 'Suspicious template; expected ${state.*}',
              });
            }
          }
        }
      }
    }

    // Cross refs for apiCall targets
    if (type === 'apiCall') {
      const service = action.service?.toString();
      const endpoint = action.endpoint?.toString();
      const services = contract.services as Record<string, any> | undefined;
      if (!service || !endpoint || !services) return;
      const svc = services[service] as Record<string, any> | undefined;
      if (!svc) {
        errors.push({ path, message: `Unknown service: ${service}` });
        return;
      }
      const endpoints = svc.endpoints as Record<string, any> | undefined;
      if (
        !endpoints ||
        !Object.prototype.hasOwnProperty.call(endpoints, endpoint)
      ) {
        errors.push({
          path,
          message: `Unknown endpoint: ${service}.${endpoint}`,
        });
      }
    }
  }

  private validateRoutes(
    pagesUi: Record<string, any>,
    errors: ValidationError[],
  ) {
    const routes = { ...(pagesUi.routes ?? {}) } as Record<string, any>;
    const pages = { ...(pagesUi.pages ?? {}) } as Record<string, any>;
    for (const [route, cfgObj] of Object.entries(routes)) {
      const cfg = cfgObj as Record<string, any> | undefined;
      const pageId = cfg?.pageId?.toString();
      if (!pageId || !Object.prototype.hasOwnProperty.call(pages, pageId)) {
        errors.push({
          path: `pagesUI.routes.${route}`,
          message: `Route pageId not found: ${pageId}`,
        });
      }
    }
  }

  private validateServices(
    contract: Record<string, any>,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ) {
    const services = { ...(contract.services ?? {}) } as Record<string, any>;
    const models = { ...(contract.dataModels ?? {}) } as Record<string, any>;
    for (const [name, svcObj] of Object.entries(services)) {
      const svc = { ...(svcObj as Record<string, any>) };
      const endpoints = { ...(svc.endpoints ?? {}) } as Record<string, any>;
      for (const [endpointName, cfgObj] of Object.entries(endpoints)) {
        const cfg = cfgObj as Record<string, any>;
        const schema = cfg.responseSchema;
        if (typeof schema === 'object' && schema) {
          const type = schema.type;
          const props = schema.properties;
          if (type !== 'object' || typeof props !== 'object' || !props) {
            errors.push({
              path: `services.${name}.endpoints.${endpointName}.responseSchema`,
              message: 'Schema must be an object with properties',
            });
            continue;
          }
          const dataProp = props.data;
          if (typeof dataProp === 'object' && dataProp) {
            if (dataProp.type === 'array') {
              const items = dataProp.items;
              const ref =
                typeof items === 'object' && items
                  ? items['$ref']?.toString()
                  : undefined;
              if (!ref || !this.refExists(ref, models)) {
                errors.push({
                  path: `services.${name}.endpoints.${endpointName}.responseSchema.properties.data.items`,
                  message: 'Missing or unknown $ref in items',
                });
              }
            } else if (typeof dataProp['$ref'] === 'string') {
              const ref = dataProp['$ref'] as string;
              if (!this.refExists(ref, models)) {
                errors.push({
                  path: `services.${name}.endpoints.${endpointName}.responseSchema.properties.data`,
                  message: 'Unknown $ref',
                });
              }
            } else {
              warnings.push({
                path: `services.${name}.endpoints.${endpointName}.responseSchema.properties.data`,
                message: 'Prefer $ref to dataModels over raw types',
              });
            }
          } else {
            errors.push({
              path: `services.${name}.endpoints.${endpointName}.responseSchema.properties`,
              message: 'Missing required data property',
            });
          }
        } else {
          if (schema != null && typeof schema !== 'object') {
            errors.push({
              path: `services.${name}.endpoints.${endpointName}.responseSchema`,
              message: 'Invalid schema structure',
            });
          }
        }
      }
    }
  }

  private validateState(
    state: Record<string, any>,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ) {
    const global = { ...(state.global ?? {}) } as Record<string, any>;
    const pages = { ...(state.pages ?? {}) } as Record<string, any>;
    for (const [key, value] of Object.entries(global)) {
      const field =
        typeof value === 'object' && value
          ? ({ ...(value as Record<string, any>) } as Record<string, any>)
          : undefined;
      this.validateStateField(`state.global.${key}`, field, errors, warnings);
    }
    for (const [pageKey, fieldsObj] of Object.entries(pages)) {
      const fields =
        typeof fieldsObj === 'object' && fieldsObj
          ? ({ ...(fieldsObj as Record<string, any>) } as Record<string, any>)
          : {};
      for (const [key, value] of Object.entries(fields)) {
        const field =
          typeof value === 'object' && value
            ? ({ ...(value as Record<string, any>) } as Record<string, any>)
            : undefined;
        this.validateStateField(
          `state.pages.${pageKey}.${key}`,
          field,
          errors,
          warnings,
        );
      }
    }
  }

  private validateStateField(
    path: string,
    field: Record<string, any> | undefined,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ) {
    if (!field) {
      warnings.push({ path, message: 'State field should be an object' });
      return;
    }
    const persistence = field.persistence?.toString();
    if (
      persistence &&
      !ContractValidator.supportedPersistence.includes(persistence)
    ) {
      errors.push({
        path: `${path}.persistence`,
        message: `Unsupported persistence: ${persistence}`,
      });
    }
    const type = field.type?.toString();
    if (
      type &&
      !['string', 'number', 'boolean', 'object', 'array'].includes(type)
    ) {
      warnings.push({
        path: `${path}.type`,
        message: `Unexpected type: ${type}`,
      });
    }
  }

  private validateCrossReferences(
    contract: Record<string, any>,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ) {
    const mapping = contract.assets?.icons?.mapping as
      | Record<string, any>
      | undefined;
    if (mapping) {
      const pages = (contract.pagesUI?.pages ?? {}) as Record<string, any>;
      const used = new Set<string>();
      const collect = (node: any) => {
        if (node && typeof node === 'object') {
          const iconName = node.icon?.toString() ?? node.name?.toString();
          const type = node.type?.toString();
          if (iconName && (type === 'icon' || type === 'iconButton')) {
            used.add(iconName);
          }
          for (const v of Object.values(node)) collect(v);
        } else if (Array.isArray(node)) {
          for (const v of node) collect(v);
        }
      };

      for (const page of Object.values(pages)) collect(page);
      for (const icon of used) {
        if (!Object.prototype.hasOwnProperty.call(mapping, icon)) {
          warnings.push({
            path: `assets.icons.mapping.${icon}`,
            message: 'Icon not mapped',
          });
        }
      }
    }
  }

  // Helpers
  private isStateBinding(binding: string): boolean {
    return /^\$\{state\.[^}]+\}$/.test(binding);
  }
  private isItemBinding(binding: string): boolean {
    return /^\$\{item\.[^}]+\}$/.test(binding);
  }
  private looksLikeItemField(binding: string): boolean {
    return /^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(binding);
  }
  private looksLikeTemplate(v: string): boolean {
    return /^\$\{[^}]+\}$/.test(v);
  }
  private isStateTemplate(v: string): boolean {
    return /^\$\{state\.[^}]+\}$/.test(v);
  }
  private refExists(ref: string, models: Record<string, any>): boolean {
    if (!ref.startsWith('#/dataModels/')) return false;
    const key = ref.substring('#/dataModels/'.length);
    return Object.prototype.hasOwnProperty.call(models, key);
  }
}

/** Internal doc feature extractor: parses docs to build supported lists. */
class DocFeatures {
  private static _instance: DocFeatures | null = null;
  static get instance(): DocFeatures {
    if (!this._instance) this._instance = new DocFeatures();
    return this._instance;
  }

  public components: string[] = [];
  public actions: string[] = [];
  public validations: string[] = [];

  constructor() {
    this.init();
  }

  private init() {
    try {
      const dslPath = join(process.cwd(), 'docs', 'dsl_cheat_sheet.md');
      if (existsSync(dslPath)) {
        const content = readFileSync(dslPath, 'utf8').split(/\r?\n/);
        for (let i = 0; i < content.length; i++) {
          const line = content[i].trim();
          if (line.includes('Supported `type` values:')) {
            const listLine =
              i + 1 < content.length ? content[i + 1].trim() : '';
            const list = listLine.replace(/^\-\s*/, '');
            this.components.push(
              ...list
                .split(',')
                .map((e) => e.trim())
                .filter((e) => e.length > 0),
            );
          }
          if (line.includes('Allowed `action` values:')) {
            const listLine =
              i + 1 < content.length ? content[i + 1].trim() : '';
            const list = listLine.replace(/^\-\s*/, '');
            this.actions.push(
              ...list
                .split(',')
                .map((e) => e.trim())
                .filter((e) => e.length > 0),
            );
          }
        }
      }
      const compRefPath = join(
        process.cwd(),
        'docs',
        'components_reference.md',
      );
      if (existsSync(compRefPath)) {
        const lines = readFileSync(compRefPath, 'utf8').split(/\r?\n/);
        for (const l of lines) {
          const line = l.trim();
          if (line.startsWith('- Inline `validation`')) {
            const keysLine = line.split(':').pop() || '';
            const list = keysLine
              .replace(/`/g, '')
              .split(',')
              .map((e) => e.trim())
              .filter((e) => e.length > 0);
            this.validations.push(...list);
          }
        }
        if (!this.validations.includes('equal')) this.validations.push('equal');
      }
    } catch {
      // Silently fallback to constants.
    }
  }
}
