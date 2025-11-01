import { AnalyticsSummary, PainPoint } from '../analytics/types';

export function buildSystemPrompt(model: string): string {
  // Model is accepted for potential future tuning; not embedded in text
  return (
    'You are a senior UX optimization expert focused on mobile-first design. ' +
    'Apply Nielsen’s 10 Usability Heuristics: visibility of system status; match between system and the real world; user control and freedom; consistency and standards; error prevention; recognition rather than recall; flexibility and efficiency of use; aesthetic and minimalist design; help users recognize, diagnose, and recover from errors; help and documentation. ' +
    'Optimize interactions, navigation, and forms with minimal cognitive load while preserving semantics. ' +
    'Always return valid JSON conforming to the supplied schema. ' +
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
        'Partial contract with meta and pagesUI.pages ONLY (authenticated scope). Exclude public pages and all other sections (services, routes, dataModels, state, themes).',
      explanationField:
        'Place human-readable reasoning in meta.optimizationExplanation',
      scope: 'authenticated-only',
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
        'Partial contract with meta and pagesUI.pages ONLY (authenticated scope). Exclude public pages and all other sections (services, routes, dataModels, state, themes).',
      explanationField:
        'Place human-readable reasoning in meta.optimizationExplanation',
      scope: 'authenticated-only',
    },
  });
}