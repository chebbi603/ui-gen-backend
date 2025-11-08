import { AnalyticsSummary, PainPoint } from '../analytics/types';

export function buildSystemPrompt(model: string): string {
  // Model is accepted for potential future tuning; not embedded in text
  return (
    'You are a senior UX optimization expert focused on mobile-first design. ' +
    'Apply Nielsen’s 10 Usability Heuristics: visibility of system status; match between system and the real world; user control and freedom; consistency and standards; error prevention; recognition rather than recall; flexibility and efficiency of use; aesthetic and minimalist design; help users recognize, diagnose, and recover from errors; help and documentation. ' +
    'Optimize interactions, navigation, and forms with minimal cognitive load while preserving semantics. ' +
    'CRITICAL: Always make at least one concrete change to pagesUI (e.g., adjust a label, reorder an item, tweak grid columns, add helper text) — do not return an identical contract. ' +
    'STRICTLY FORBIDDEN: (1) Adding new component TYPES or new PROPERTIES not present in currentContract; (2) Creating or modifying PUBLIC pages — only authenticated/private pages are allowed; (3) Introducing unknown schema fields or actions unsupported by the backend/parser. ' +
    'Allowed modifications ONLY: reorder existing children, resize existing components via existing style properties, highlight existing components, and adjust existing feature ranks. Do not add or remove children, pages, routes, services, state, theming, or actions beyond what exists. ' +
    'Respond ONLY with valid, complete JSON for a full contract including version (string), meta, pagesUI (authenticated pages only), and thresholds. ' +
    'Important: Only generate authenticated page sections; exclude public pages.'
  );
}

export function buildUserPrompt(
  current: Record<string, any>,
  analytics: AnalyticsSummary,
  painPoints: PainPoint[],
): string {
  const goals = [
    'Improve navigation clarity and reduce taps to reach key screens',
    'Reduce errors and friction in forms',
    'Increase engagement on underutilized pages and components',
    'Optimize for mobile ergonomics and thumb reach',
    'Ensure consistent components and actions from supported lists',
  ];
  const payload = {
    currentContract: current,
    analytics,
    painPoints,
    optimizationGoals: goals,
    outputRequirements: {
      format: 'JSON only',
      schema:
        'Full contract JSON including ONLY these top-level keys: version (string), meta, pagesUI (authenticated scope only), thresholds (numeric values). Exclude public pages and exclude optional sections (services, routes, dataModels, state, theming, eventsActions). Do NOT include explanations outside JSON.',
      forbiddenRules: [
        'Do NOT add new component types',
        'Do NOT add new properties on any component',
        'Do NOT include public pages or routes to public pages',
        'Do NOT include unknown schema fields or unsupported actions',
      ],
      allowedChanges: [
        'Reorder existing children only (no add/remove)',
        'Resize using existing style keys only (no new style keys)',
        'Highlight existing components using existing fields only',
        'Adjust feature ranking using existing fields only',
      ],
      example: {
        version: '0.1.0',
        meta: {
          optimizationExplanation:
            'Explain key changes made and why (1-3 sentences).',
          isPartial: false,
          generatedAt: '<ISO timestamp>',
        },
        thresholds: {
          rageThreshold: 3,
          rageWindowMs: 1000,
          repeatThreshold: 3,
          repeatWindowMs: 2000,
          formRepeatWindowMs: 10000,
          formFailWindowMs: 10000,
        },
        pagesUI: {
          pages: {
            Home: {
              id: 'Home',
              title: 'Home',
              scope: 'authenticated',
              layout: 'column',
              // Existing children preserved, only ORDER changed and existing STYLE values adjusted.
              children: [
                { type: 'button', label: 'Get Started', style: { width: 120 } },
                { type: 'text', value: 'Welcome', style: { fontSize: 18 } },
                // Note: No new component types or properties are introduced; only order/size changed.
              ],
            },
          },
        },
      },
      explanationField:
        'Place human-readable reasoning in meta.optimizationExplanation',
      scope: 'authenticated-only',
      nonTrivialChangeRule:
        'You MUST change at least one component or property compared to currentContract (e.g., reorder items, adjust existing style sizes). Return differences, not a verbatim copy.',
    },
  };
  return JSON.stringify(payload);
}

export function buildRetryPrompt(
  current: Record<string, any>,
  analytics: AnalyticsSummary,
  painPoints: PainPoint[],
  errors: string[],
): string {
  return JSON.stringify({
    currentContract: current,
    analytics,
    painPoints,
    correction: {
      reason: 'Previous output failed validation; correct the following issues',
      errors,
    },
    outputRequirements: {
      format: 'JSON only',
      schema:
        'Full contract JSON including ONLY: version (string), meta, pagesUI.pages (authenticated scope only), thresholds (numeric values). Exclude public pages and optional sections. Do NOT include explanations outside JSON. Do NOT add new component types/properties.',
      explanationField:
        'Place human-readable reasoning in meta.optimizationExplanation',
      scope: 'authenticated-only',
      nonTrivialChangeRule:
        'You MUST change at least one component or property compared to currentContract.',
    },
  });
}