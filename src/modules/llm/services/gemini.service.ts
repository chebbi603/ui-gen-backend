import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ContractService } from '../../contract/services/contract.service';
import { EventService } from '../../event/services/event.service';
import { SessionService } from '../../session/services/session.service';
import { GeminiClient } from '../clients/gemini.client';
import { validateContractJson } from '../../../common/validators/contract.validator';

type AnalyticsSummary = {
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

type PainPoint = {
  type: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  metadata?: Record<string, any>;
};

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private failures = 0;
  private openUntil = 0;
  private readonly threshold = 3;
  private readonly cooldownMs = 60_000;

  constructor(
    private readonly config: ConfigService,
    private readonly contractService: ContractService,
    private readonly eventService: EventService,
    private readonly sessionService: SessionService,
    private readonly gemini: GeminiClient,
  ) {}

  isCircuitOpen(): boolean {
    const now = Date.now();
    if (this.openUntil && now < this.openUntil) return true;
    if (this.openUntil && now >= this.openUntil) {
      this.openUntil = 0;
      this.failures = 0;
      this.logger.warn('Circuit breaker reset after cooldown.');
    }
    return false;
  }

  /**
   * Admin-only manual reset of circuit breaker state.
   */
  resetCircuitBreaker(): void {
    this.failures = 0;
    this.openUntil = 0;
    this.logger.log('Circuit breaker manually reset by admin.');
  }

  private recordFailure() {
    this.failures += 1;
    if (this.failures >= this.threshold && !this.isCircuitOpen()) {
      this.openUntil = Date.now() + this.cooldownMs;
      this.logger.error(
        `Circuit opened after ${this.failures} consecutive failures; cooling down for ${this.cooldownMs}ms.`,
      );
    }
  }

  private recordSuccess() {
    if (this.failures > 0 || this.openUntil) {
      this.logger.log('Resetting failure count due to successful call.');
    }
    this.failures = 0;
    this.openUntil = 0;
  }

  async generateOptimizedContract(params: {
    userId: string;
    baseContract?: Record<string, unknown>;
    version?: string;
  }): Promise<{ version: string; json: Record<string, unknown> }> {
    const provider = (
      this.config.get<string>('llm.provider') || ''
    ).toLowerCase();
    if (provider !== 'gemini' || !this.gemini.isEnabled()) {
      return this.fallbackHeuristic(params);
    }
    if (this.isCircuitOpen()) {
      throw new Error(
        'LLM service temporarily unavailable due to repeated failures.',
      );
    }

    try {
      const analytics = await this.computeAnalytics(params.userId);
      const painPoints = await this.detectPainPoints(params.userId);
      const current =
        params.baseContract ||
        (await this.contractService.findLatestByUser(params.userId))?.json ||
        {};

      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildUserPrompt(
        current as Record<string, any>,
        analytics,
        painPoints,
      );

      const text = await this.callGemini(userPrompt, systemPrompt);
      const parsed = this.parseJsonStrict(text);

      const validation = validateContractJson(parsed);
      if (!validation.valid) {
        const retryText = await this.callGemini(
          this.buildRetryPrompt(
            current as Record<string, any>,
            analytics,
            painPoints,
            validation.errors || [],
          ),
          systemPrompt,
        );
        const retried = this.parseJsonStrict(retryText);
        const retryValidation = validateContractJson(retried);
        if (!retryValidation.valid) {
          this.recordFailure();
          return this.fallbackSafe(current as Record<string, any>, params);
        }
        this.recordSuccess();
        const nextVersion = this.bumpPatch(
          params.version ||
            (await this.contractService.findLatestByUser(params.userId))
              ?.version ||
            '0.1.0',
        );
        return { version: nextVersion, json: retried };
      }

      this.recordSuccess();
      const nextVersion = this.bumpPatch(
        params.version ||
          (await this.contractService.findLatestByUser(params.userId))
            ?.version ||
          '0.1.0',
      );
      return { version: nextVersion, json: parsed };
    } catch (err: any) {
      this.logger.error(`Gemini generation failed: ${err?.message || err}`);
      this.recordFailure();
      throw err;
    }
  }

  private async computeAnalytics(userId: string): Promise<AnalyticsSummary> {
    const events = await this.eventService.listByUser(userId, 'ADMIN', userId);
    const totalEvents = events.length;
    const eventTypeCounts: Record<string, number> = {};
    const tapsPerComponent: Record<string, number> = {};
    const pageViews: Record<string, number> = {};
    for (const e of events as any[]) {
      const t = (e as any).eventType?.toString?.() || 'unknown';
      eventTypeCounts[t] = (eventTypeCounts[t] || 0) + 1;
      if (t === 'tap') {
        const id = (e as any).componentId?.toString?.() || 'unknown';
        tapsPerComponent[id] = (tapsPerComponent[id] || 0) + 1;
      }
      if (t === 'view') {
        const pg = (e as any).page?.toString?.() || 'unknown';
        pageViews[pg] = (pageViews[pg] || 0) + 1;
      }
    }
    const errorRate =
      totalEvents > 0 ? (eventTypeCounts['error'] || 0) / totalEvents : 0;
    const mostClickedComponents = Object.entries(tapsPerComponent)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, taps]) => ({ id, taps }));

    let averageSessionDurationSec: number | undefined;
    let averageSessionEngagement: number | undefined;
    const sessions = await this.sessionService.listByUser(
      userId,
      'ADMIN',
      userId,
    );
    if (sessions && sessions.length > 0) {
      const durations: number[] = [];
      const eventsBySession: Record<string, number> = {};
      for (const s of sessions as any[]) {
        const start = (s as any).startedAt
          ? new Date((s as any).startedAt).getTime()
          : undefined;
        const end = (s as any).endedAt
          ? new Date((s as any).endedAt).getTime()
          : undefined;
        if (start && end && end > start) durations.push((end - start) / 1000);
        const sid = (s as any)._id?.toString?.();
        if (sid) {
          eventsBySession[sid] = 0;
        }
      }
      for (const e of events as any[]) {
        const sid = (e as any).sessionId?.toString?.();
        if (sid && Object.prototype.hasOwnProperty.call(eventsBySession, sid)) {
          eventsBySession[sid] += 1;
        }
      }
      averageSessionDurationSec = durations.length
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : undefined;
      const engagementVals = Object.values(eventsBySession);
      averageSessionEngagement = engagementVals.length
        ? engagementVals.reduce((a, b) => a + b, 0) / engagementVals.length
        : undefined;
    }

    const pagesSorted = Object.entries(pageViews).sort((a, b) => b[1] - a[1]);
    const topPages = pagesSorted.slice(0, 5).map(([p]) => p);
    const underutilizedPages = pagesSorted.slice(-3).map(([p]) => p);

    return {
      totalEvents,
      eventTypeCounts,
      errorRate,
      mostClickedComponents,
      pageVisitFrequency: pageViews,
      averageSessionDurationSec,
      averageSessionEngagement,
      topPages,
      underutilizedPages,
    };
  }

  private async detectPainPoints(userId: string): Promise<PainPoint[]> {
    const events = (await this.eventService.listByUser(
      userId,
      'ADMIN',
      userId,
    )) as any[];
    const points: PainPoint[] = [];
    const byComponent: Record<string, any[]> = {};
    const byPage: Record<string, any[]> = {};
    for (const e of events) {
      const id = e.componentId?.toString?.() || 'unknown';
      const pg = e.page?.toString?.() || 'unknown';
      byComponent[id] = byComponent[id] || [];
      byComponent[id].push(e);
      byPage[pg] = byPage[pg] || [];
      byPage[pg].push(e);
    }
    for (const [compId, list] of Object.entries(byComponent)) {
      const taps = list
        .filter((e) => e.eventType === 'tap')
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      let streak = 1;
      for (let i = 1; i < taps.length; i++) {
        const prev = taps[i - 1].timestamp.getTime();
        const curr = taps[i].timestamp.getTime();
        if (curr - prev <= 1000) streak += 1;
        else streak = 1;
        if (streak >= 3) {
          points.push({
            type: 'rage_click',
            severity: 'high',
            message: 'Rapid repeated taps detected',
            metadata: { componentId: compId, count: streak, windowMs: 1000 },
          });
          break;
        }
      }
    }
    for (const e of events) {
      if (e.eventType === 'error') {
        const sev = (e.data?.severity || 'medium') as string;
        const s = ['low', 'medium', 'high'].includes(sev)
          ? (sev as any)
          : 'medium';
        points.push({
          type: 'error_event',
          severity: s,
          message: 'Error event captured',
          metadata: { page: e.page, componentId: e.componentId, severity: s },
        });
      }
    }
    for (const [pg, list] of Object.entries(byPage)) {
      const views = list
        .filter((e) => e.eventType === 'view')
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      for (let i = 0; i < views.length; i++) {
        const start = views[i].timestamp.getTime();
        let nextInteractionTime: number | undefined;
        for (let j = i + 1; j < list.length; j++) {
          const e = list[j];
          const t = e.timestamp.getTime();
          if (t <= start) continue;
          if (
            e.eventType === 'tap' ||
            e.eventType === 'input' ||
            e.eventType === 'navigate'
          ) {
            nextInteractionTime = t;
            break;
          }
        }
        if (!nextInteractionTime) continue;
        const dwellSec = (nextInteractionTime - start) / 1000;
        if (dwellSec > 10) {
          points.push({
            type: 'long_dwell',
            severity: 'medium',
            message: 'Long dwell without interaction',
            metadata: { page: pg, dwellSeconds: dwellSec },
          });
        }
      }
    }
    const formFails = events.filter((e) => e.eventType === 'form-fail');
    for (const e of formFails) {
      points.push({
        type: 'form_abandonment',
        severity: 'high',
        message: 'Form submission failed or abandoned',
        metadata: { page: e.page, componentId: e.componentId },
      });
    }
    return points;
  }

  private buildSystemPrompt(): string {
    const model =
      this.config.get<string>('llm.gemini.model') || 'gemini-2.5-pro';
    this.logger.log(`Using Gemini model '${model}' for contract optimization.`);
    return (
      'You are a senior UX optimization expert focused on mobile-first design. ' +
      'Apply Nielsen’s 10 Usability Heuristics: visibility of system status; match between system and the real world; user control and freedom; consistency and standards; error prevention; recognition rather than recall; flexibility and efficiency of use; aesthetic and minimalist design; help users recognize, diagnose, and recover from errors; help and documentation. ' +
      'Optimize interactions, navigation, and forms with minimal cognitive load while preserving semantics. ' +
      'Always return valid JSON conforming to the supplied schema.'
    );
  }

  private buildUserPrompt(
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
          'Contract with meta and pagesUI.pages and supported components/actions',
        explanationField:
          'Place human-readable reasoning in meta.optimizationExplanation',
      },
    };
    return JSON.stringify(payload);
  }

  private buildRetryPrompt(
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
        reason:
          'Previous output failed validation; correct the following issues',
        errors,
      },
      outputRequirements: {
        format: 'JSON only',
        schema:
          'Contract with meta and pagesUI.pages and supported components/actions',
        explanationField:
          'Place human-readable reasoning in meta.optimizationExplanation',
      },
    });
  }

  private async callGemini(
    userPrompt: string,
    systemPrompt: string,
  ): Promise<string> {
    const model =
      this.config.get<string>('llm.gemini.model') || 'gemini-2.5-pro';
    const ai: any = (this.gemini as any)['ai'];
    if (!ai) throw new Error('Gemini client not initialized.');
    const req: any = {
      model,
      systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    };
    const res = await ai.models.generateContent(req);
    const text =
      (res && (res.text || res.candidates?.[0]?.content?.parts?.[0]?.text)) ||
      '';
    return text;
  }

  private parseJsonStrict(text: string): Record<string, any> {
    const cleaned = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    let obj: any;
    try {
      obj = JSON.parse(cleaned);
    } catch {
      obj = {
        meta: {},
        pagesUI: { pages: {} },
        explanation: 'Parse failure; fallback structure',
      };
    }
    if (!obj.meta) obj.meta = {};
    if (!obj.pagesUI) obj.pagesUI = { pages: {} };
    obj.meta = {
      ...(obj.meta || {}),
      optimizationExplanation:
        obj.meta?.optimizationExplanation || 'Generated by Gemini',
    };
    return obj;
  }

  private fallbackHeuristic(params: {
    userId: string;
    baseContract?: Record<string, unknown>;
    version?: string;
  }) {
    return (async () => {
      const events = await this.eventService.listByUser(
        params.userId,
        'ADMIN',
        params.userId,
      );
      const counts = (events as any[]).reduce<Record<string, number>>(
        (acc, e) => {
          const t = (e as any).eventType?.toString?.() || 'unknown';
          acc[t] = (acc[t] || 0) + 1;
          return acc;
        },
        {},
      );
      const current =
        params.baseContract ||
        (await this.contractService.findLatestByUser(params.userId))?.json ||
        {};
      const json = {
        ...current,
        analytics: { eventCounts: counts },
        meta: { ...((current as any).meta || {}) },
      } as Record<string, unknown>;
      const nextVersion = this.bumpPatch(
        params.version ||
          (await this.contractService.findLatestByUser(params.userId))
            ?.version ||
          '0.1.0',
      );
      return { version: nextVersion, json };
    })();
  }

  private fallbackSafe(
    current: Record<string, any>,
    params: { userId: string; version?: string },
  ) {
    const json = {
      meta: { optimizationExplanation: 'Fallback due to validation failure' },
      pagesUI: { pages: {} },
      ...(current || {}),
    };
    const nextVersion = this.bumpPatch(params.version || '0.1.0');
    return { version: nextVersion, json };
  }

  private bumpPatch(v: string): string {
    const [major, minor, patch] = v.split('.').map((x) => parseInt(x, 10));
    if ([major, minor, patch].some((n) => Number.isNaN(n))) return '0.1.0';
    return `${major}.${minor}.${patch + 1}`;
  }
}
