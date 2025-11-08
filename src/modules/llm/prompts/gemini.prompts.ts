import { AnalyticsSummary, PainPoint } from '../analytics/types';

export function buildSystemPrompt(model: string): string {
  // Model is accepted for potential future tuning; not embedded in text
  return (
    'You are a senior UX optimization expert focused on mobile-first design. ' +
    'Apply Nielsen’s 10 Usability Heuristics: visibility of system status; match between system and the real world; user control and freedom; consistency and standards; error prevention; recognition rather than recall; flexibility and efficiency of use; aesthetic and minimalist design; help users recognize, diagnose, and recover from errors; help and documentation. ' +
    'Optimize interactions, navigation, and forms with minimal cognitive load while preserving semantics. ' +
    'CRITICAL: Always make at least one concrete change to pagesUI (e.g., adjust a label, reorder an item, tweak grid columns, add helper text) — do not return an identical contract. ' +
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
        'Full contract JSON including: version (string), meta, pagesUI.pages (authenticated scope only), thresholds (numeric values). Exclude public pages and optional sections unless necessary (services, routes, dataModels, state, theming). Do NOT include explanations outside JSON.',
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
              children: [
                { type: 'text', value: 'Welcome', style: { fontSize: 16 } },
              ],
            },
          },
        },
      },
      explanationField:
        'Place human-readable reasoning in meta.optimizationExplanation',
      scope: 'authenticated-only',
      nonTrivialChangeRule:
        'You MUST change at least one component or property compared to currentContract (e.g., reorder items, modify labels, add helper text, adjust grid size). Return differences, not a verbatim copy.',
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
        'Full contract JSON including: version (string), meta, pagesUI.pages (authenticated scope only), thresholds (numeric values). Exclude public pages and optional sections unless necessary. Do NOT include explanations outside JSON.',
      explanationField:
        'Place human-readable reasoning in meta.optimizationExplanation',
      scope: 'authenticated-only',
      nonTrivialChangeRule:
        'You MUST change at least one component or property compared to currentContract.',
    },
  });
}