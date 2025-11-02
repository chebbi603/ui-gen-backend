import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ContractService } from '../../contract/services/contract.service';
import { EventService } from '../../event/services/event.service';
import { SessionService } from '../../session/services/session.service';
import { GeminiClient } from '../clients/gemini.client';
import { validateContractJson } from '../../../common/validators/contract.validator';
import { CacheService } from '../../../common/services/cache.service';
import {
  AggregationSummary,
  AnalyticsSummary,
  PainPoint,
  ErrorMetrics,
  UsageStats,
} from '../analytics/types';
import {
  analyzeErrors,
  calculateComponentUsage,
  detectFormAbandonment,
  detectLongDwells,
  detectRageClicks,
} from '../analytics/helpers';
import { parseJsonStrict } from '../utils/json';
import {
  buildRetryPrompt,
  buildSystemPrompt,
  buildUserPrompt,
} from '../prompts/gemini.prompts';

// Types moved to ../analytics/types

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
    private readonly cache: CacheService,
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
      // Determine authenticated pages from current/ base contract to scope analytics and output
      const current =
        params.baseContract ||
        (await this.contractService.findLatestByUser(params.userId))?.json ||
        {};
      const authPages = this.extractAuthenticatedPages(
        current as Record<string, any>,
      );

      // Filter analytics to authenticated pages only
      const summary = await this.aggregateAnalytics(params.userId, authPages);
      const analytics: any = summary;
      const painPoints = [
        ...summary.rageClickPainPoints,
        ...summary.formAbandonmentPainPoints,
        ...summary.errorPainPoints,
        ...summary.longDwellPainPoints,
      ];

      const model = this.config.get<string>('llm.gemini.model') || 'gemini-2.5-pro';
      this.logger.log(`Using Gemini model '${model}' for contract optimization.`);
      const systemPrompt = buildSystemPrompt(model);
      const userPrompt = buildUserPrompt(
        current as Record<string, any>,
        analytics,
        painPoints,
      );

      const text = await this.callGemini(userPrompt, systemPrompt);
      const parsed = parseJsonStrict(text);

      // Build partial contract from authenticated pages only
      const partialJson = this.buildAuthenticatedPartial(
        parsed,
        authPages,
      );

      const validation = validateContractJson(partialJson);
      if (!validation.valid) {
        const retryText = await this.callGemini(
          buildRetryPrompt(
            current as Record<string, any>,
            analytics as any,
            painPoints,
            validation.errors || [],
          ),
          systemPrompt,
        );
        const retried = parseJsonStrict(retryText);
        const retriedPartial = this.buildAuthenticatedPartial(
          retried,
          authPages,
        );
        const retryValidation = validateContractJson(retriedPartial);
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
        return { version: nextVersion, json: retriedPartial };
      }

      this.recordSuccess();
      const nextVersion = this.bumpPatch(
        params.version ||
          (await this.contractService.findLatestByUser(params.userId))
            ?.version ||
          '0.1.0',
      );
  return { version: nextVersion, json: partialJson };
    } catch (err: any) {
      this.logger.error(`Gemini generation failed: ${err?.message || err}`);
      this.recordFailure();
      throw err;
    }
  }







  async aggregateAnalytics(
    userId: string,
    allowedPages?: Set<string>,
  ): Promise<AggregationSummary> {
    const cacheKey = `llm:analytics:${userId}${
      allowedPages ? ':auth' : ''
    }`;
    const cached = await this.cache.get<AggregationSummary>(cacheKey);
    if (cached) return cached;
    let events = (await this.eventService.listByUser(
      userId,
      'ADMIN',
      userId,
    )) as any[];
    if (allowedPages && allowedPages.size > 0) {
      events = events.filter((e) =>
        allowedPages.has(String((e as any).page || 'unknown')),
      );
    }
    const totalEvents = events.length;
    const eventTypeDistribution = events.reduce<Record<string, number>>((acc, e) => {
      const t = String(e.eventType || 'unknown');
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {});
    const rageClickPainPoints = detectRageClicks(events);
    const formAbandonmentPainPoints = detectFormAbandonment(events);
    const { painPoints: errorPainPoints, metrics: errorMetrics } = analyzeErrors(events);
    const longDwellPainPoints = detectLongDwells(events);
    const componentUsageStats = calculateComponentUsage(events);
    const errorRate = errorMetrics.errorRate;
    const summary: AggregationSummary = {
      totalEvents,
      eventTypeDistribution,
      errorRate,
      rageClickPainPoints,
      formAbandonmentPainPoints,
      errorPainPoints,
      longDwellPainPoints,
      componentUsageStats,
    };
    await this.cache.set(cacheKey, summary, 300);
    return summary;
  }


  async callGemini(
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


  private fallbackHeuristic(params: {
    userId: string;
    baseContract?: Record<string, unknown>;
    version?: string;
  }) {
    return (async () => {
      const current =
        params.baseContract ||
        (await this.contractService.findLatestByUser(params.userId))?.json ||
        {};
      const authPages = this.extractAuthenticatedPages(
        current as Record<string, any>,
      );
      const pages = (current as any)?.pagesUI?.pages || {};
      const filtered: Record<string, any> = {};
      Object.entries(pages || {}).forEach(([name, page]) => {
        if (authPages.has(name)) filtered[name] = page;
      });
      const json = {
        meta: {
          ...(((current as any)?.meta as any) || {}),
          optimizationExplanation:
            'Heuristic partial (authenticated pages) due to provider unavailability',
          isPartial: true,
          generatedAt: new Date().toISOString(),
        },
        pagesUI: { pages: filtered },
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
    const authPages = this.extractAuthenticatedPages(current || {});
    const pages = (current as any)?.pagesUI?.pages || {};
    const filtered: Record<string, any> = {};
    Object.entries(pages || {}).forEach(([name, page]) => {
      if (authPages.has(name)) filtered[name] = page;
    });
    const json = {
      meta: {
        optimizationExplanation: 'Fallback due to validation failure',
        isPartial: true,
        generatedAt: new Date().toISOString(),
      },
      pagesUI: { pages: filtered },
    };
    const nextVersion = this.bumpPatch(params.version || '0.1.0');
    return { version: nextVersion, json };
  }

  private bumpPatch(v: string): string {
    const [major, minor, patch] = v.split('.').map((x) => parseInt(x, 10));
    if ([major, minor, patch].some((n) => Number.isNaN(n))) return '0.1.0';
    return `${major}.${minor}.${patch + 1}`;
  }

  // Helper: extract authenticated page names from a contract
  private extractAuthenticatedPages(current: Record<string, any>): Set<string> {
    const pages = (current as any)?.pagesUI?.pages || {};
    const names = Object.keys(pages || {}).filter((name) => {
      const page: any = (pages as any)[name] || {};
      const scope = String(
        (page?.meta?.scope ?? page?.scope ?? page?.pageScope ?? '') || '',
      ).toLowerCase();
      return scope === 'authenticated' || scope === 'private';
    });
    return new Set(names);
  }

  // Helper: build partial authenticated-only contract from LLM output
  private buildAuthenticatedPartial(
    llmOutput: Record<string, any>,
    authPages: Set<string>,
  ): Record<string, any> {
    const outPages = (llmOutput as any)?.pagesUI?.pages || {};
    const filtered: Record<string, any> = {};
    Object.entries(outPages || {}).forEach(([name, page]) => {
      const scope = String(
        ((page as any)?.meta?.scope ?? (page as any)?.scope ?? (page as any)?.pageScope ?? '') || '',
      ).toLowerCase();
      if (scope === 'authenticated' || authPages.has(name)) {
        filtered[name] = page;
      }
    });
    return {
      meta: {
        ...((llmOutput as any)?.meta || {}),
        optimizationExplanation:
          ((llmOutput as any)?.meta?.optimizationExplanation || 'Generated by Gemini'),
        isPartial: true,
        generatedAt: new Date().toISOString(),
      },
      pagesUI: { pages: filtered },
    };
  }
}
