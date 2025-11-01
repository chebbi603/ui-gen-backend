import { PainPoint, ErrorMetrics, UsageStats } from './types';

export function detectRageClicks(events: any[]): PainPoint[] {
  const groups: Record<string, { count: number; sample: any }> = {};
  for (const e of events) {
    if (e.eventType !== 'tap') continue;
    const ts = e.timestamp instanceof Date ? e.timestamp.getTime() : new Date(e.timestamp).getTime();
    const sec = Math.floor(ts / 1000);
    const key = `${e.componentId}_${sec}`;
    if (!groups[key]) groups[key] = { count: 0, sample: e };
    groups[key].count += 1;
  }
  const points: PainPoint[] = [];
  for (const { count, sample } of Object.values(groups)) {
    if (count >= 3) {
      const severity: 'medium' | 'high' = count >= 5 ? 'high' : 'medium';
      points.push({
        type: 'rage-click',
        severity,
        message: `Detected ${count} taps within 1s on component`,
        metadata: { componentId: sample.componentId, count },
      });
    }
  }
  return points;
}

export function detectFormAbandonment(events: any[]): PainPoint[] {
  const sorted = [...events].sort(
    (a, b) => (a.timestamp as Date).getTime() - (b.timestamp as Date).getTime(),
  );
  const points: PainPoint[] = [];
  const seenClusters = new Set<string>();
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    if (e.eventType !== 'input') continue;
    const comp = e.componentId;
    const page = e.page;
    const sid = e.sessionId?.toString?.() || 'unknown';
    const startTs = (e.timestamp as Date).getTime();
    const windowEnd = startTs + 120_000;
    const clusterKey = `${sid}_${page}_${comp}_${Math.floor(startTs / 30_000)}`;
    if (seenClusters.has(clusterKey)) continue;
    let submitted = false;
    let errorInduced = false;
    let navigatedAway = false;
    for (let j = i + 1; j < sorted.length; j++) {
      const n = sorted[j];
      const nts = (n.timestamp as Date).getTime();
      if (nts < startTs) continue;
      if (nts > windowEnd) break;
      const sameContext = (n.sessionId?.toString?.() || 'unknown') === sid && n.page === page;
      if (!sameContext) continue;
      if (
        n.eventType === 'tap' &&
        (String(n.componentId).toLowerCase().includes('submit') || n.data?.action === 'formSubmit')
      ) {
        submitted = true;
      }
      if (n.eventType === 'form-fail' || (n.eventType === 'error' && submitted)) {
        errorInduced = true;
      }
      if (n.eventType === 'navigate' && String(n.data?.direction || '').toLowerCase() === 'back') {
        navigatedAway = true;
      }
    }
    if (!submitted || errorInduced || navigatedAway) {
      seenClusters.add(clusterKey);
      const severity: 'medium' | 'high' = errorInduced ? 'high' : 'medium';
      points.push({
        type: 'form-abandonment',
        severity,
        message: 'Form input cluster without successful submission',
        metadata: { page, componentId: comp, errorInduced, navigatedAway },
      });
    }
  }
  return points;
}

export function analyzeErrors(events: any[]): { painPoints: PainPoint[]; metrics: ErrorMetrics } {
  const errors = events.filter((e) => e.eventType === 'error');
  const bySeverity: Record<'critical' | 'high' | 'medium' | 'low', number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  const byComponent: Record<string, number> = {};
  const painPoints: PainPoint[] = [];
  const classify = (e: any): 'critical' | 'high' | 'medium' | 'low' => {
    const msg = String(e.data?.message || '').toLowerCase();
    const type = String(e.data?.type || '').toLowerCase();
    if (type.includes('crash') || type.includes('exception') || msg.includes('fatal')) return 'critical';
    if (
      msg.includes('failed') ||
      msg.includes('timeout') ||
      msg.includes('network') ||
      msg.includes('cannot') ||
      msg.includes('undefined')
    )
      return 'high';
    if (msg.includes('validation') || msg.includes('required') || msg.includes('invalid')) return 'medium';
    if (String(e.data?.level || '').toLowerCase() === 'warn') return 'low';
    return 'medium';
  };
  for (const e of errors) {
    const sev = classify(e);
    bySeverity[sev] += 1;
    const comp = String(e.componentId || 'unknown');
    byComponent[comp] = (byComponent[comp] || 0) + 1;
  }
  for (const [comp, count] of Object.entries(byComponent)) {
    if (count >= 2 || (errors.find((e) => String(e.componentId || 'unknown') === comp && classify(e) !== 'low'))) {
      const topSev =
        (
          errors
            .filter((e) => String(e.componentId || 'unknown') === comp)
            .map((e) => classify(e))
            .sort((a, b) => {
              const order = { critical: 3, high: 2, medium: 1, low: 0 } as any;
              return order[b] - order[a];
            })[0]
        ) || 'medium';
      painPoints.push({
        type: 'error-pattern',
        severity: topSev === 'critical' ? 'high' : topSev,
        message: `Component has repeated or severe errors (${count})`,
        metadata: { componentId: comp, count },
      });
    }
  }
  const totalEvents = events.length;
  const totalErrors = errors.length;
  const errorRate = totalEvents > 0 ? totalErrors / totalEvents : 0;
  return { painPoints, metrics: { totalErrors, errorRate, bySeverity, byComponent } };
}

export function detectLongDwells(events: any[]): PainPoint[] {
  const sorted = [...events].sort(
    (a, b) => (a.timestamp as Date).getTime() - (b.timestamp as Date).getTime(),
  );
  const points: PainPoint[] = [];
  const pageStack: Array<{ page: string; enterTs: number; interactions: number }> = [];
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    const ts = (e.timestamp as Date).getTime();
    if (e.eventType === 'view') {
      pageStack.push({ page: String(e.page || 'unknown'), enterTs: ts, interactions: 0 });
    } else if (e.eventType === 'tap' || e.eventType === 'input') {
      if (pageStack.length) pageStack[pageStack.length - 1].interactions += 1;
    } else if (e.eventType === 'navigate') {
      const current = pageStack.pop();
      if (!current) continue;
      const dwellSec = (ts - current.enterTs) / 1000;
      if (dwellSec > 10 && current.interactions === 0) {
        const isBack =
          String(e.data?.direction || '').toLowerCase() === 'back' ||
          String(e.data?.to || '') === String(e.data?.from || '');
        const severity: 'medium' | 'high' = isBack ? 'medium' : 'medium';
        points.push({
          type: 'long-dwell',
          severity,
          message: 'Long dwell without interaction, likely confusion',
          metadata: { page: current.page, dwellSeconds: dwellSec },
        });
      }
    }
  }
  return points;
}

export function calculateComponentUsage(events: any[]): UsageStats {
  const interactionTypes = new Set(['tap', 'input', 'navigate']);
  const interactionCounts: Record<string, number> = {};
  const renderCounts: Record<string, number> = {};
  for (const e of events) {
    const comp = String(e.componentId || 'unknown');
    if (interactionTypes.has(e.eventType)) {
      interactionCounts[comp] = (interactionCounts[comp] || 0) + 1;
    }
    if (e.eventType === 'view') {
      renderCounts[comp] = (renderCounts[comp] || 0) + 1;
    }
  }
  const allComponents = Array.from(new Set([...Object.keys(interactionCounts), ...Object.keys(renderCounts)]));
  const totalComponentCount = allComponents.length;
  const totalInteractions = Object.values(interactionCounts).reduce((a, b) => a + b, 0);
  const averageInteractionsPerComponent = totalComponentCount > 0 ? totalInteractions / totalComponentCount : 0;
  const mostUsed = Object.entries(interactionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([componentId, count]) => ({ componentId, count }));
  const leastUsed = Object.entries(interactionCounts)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 5)
    .map(([componentId, count]) => ({ componentId, count }));
  const interactionToRenderRatio = allComponents
    .filter((c) => (renderCounts[c] || 0) > 0)
    .map((c) => ({ componentId: c, ratio: (interactionCounts[c] || 0) / (renderCounts[c] || 1) }))
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, 10);
  return {
    mostUsed,
    leastUsed,
    totalComponentCount,
    averageInteractionsPerComponent,
    interactionToRenderRatio,
  };
}