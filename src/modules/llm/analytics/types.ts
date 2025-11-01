export type AnalyticsSummary = {
  totalEvents: number;
  eventTypeCounts: Record<string, number>;
  errorRate: number;
  mostClickedComponents: Array<{ id: string; taps: number }>;
  pageVisitFrequency: Record<string, number>;
  averageSessionDurationSec?: number;
  averageSessionEngagement?: number;
  topPages?: string[];
  underutilizedPages?: string[];
};

export type PainPoint = {
  type: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  metadata?: Record<string, any>;
};

export type ErrorMetrics = {
  totalErrors: number;
  errorRate: number;
  bySeverity: Record<'critical' | 'high' | 'medium' | 'low', number>;
  byComponent: Record<string, number>;
};

export type UsageStats = {
  mostUsed: Array<{ componentId: string; count: number }>;
  leastUsed: Array<{ componentId: string; count: number }>;
  totalComponentCount: number;
  averageInteractionsPerComponent: number;
  interactionToRenderRatio?: Array<{ componentId: string; ratio: number }>;
};

export type AggregationSummary = {
  totalEvents: number;
  eventTypeDistribution: Record<string, number>;
  errorRate: number;
  rageClickPainPoints: PainPoint[];
  formAbandonmentPainPoints: PainPoint[];
  errorPainPoints: PainPoint[];
  longDwellPainPoints: PainPoint[];
  componentUsageStats: UsageStats;
};