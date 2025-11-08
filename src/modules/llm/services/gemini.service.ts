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
  }): Promise<{ version: string; json: Record<string, unknown>; llmDebug?: { userPrompt: string; systemPrompt: string; rawResponse: string; request: any } }> {
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

      this.logger.debug(`Gemini user prompt length=${userPrompt.length}, authPages=${authPages.size}`);
      const { text, request } = await this.callGeminiContractWithDebug(userPrompt, systemPrompt);
      this.logger.debug(`Gemini raw response (first 600 chars): ${String(text || '').slice(0, 600)}`);
      const parsed = parseJsonStrict(text);

      // Build full authenticated-only contract from LLM output with thresholds fallback
      const fullJson = this.buildAuthenticatedFull(
        parsed,
        authPages,
        current as Record<string, any>,
      );

      // Pre-stamp version before validation to enforce completeness
      const currentVersion =
        params.version ||
        (await this.contractService.findLatestByUser(params.userId))?.version ||
        '0.1.0';
      (fullJson as any).version = currentVersion;
      (fullJson as any).meta = {
        ...((fullJson as any)?.meta || {}),
        version: currentVersion,
      };
      const validation = validateContractJson(fullJson);
      if (!validation.valid) {
        const { text: retryText, request: retryReq } = await this.callGeminiContractWithDebug(
          buildRetryPrompt(
            current as Record<string, any>,
            analytics as any,
            painPoints,
            validation.errors || [],
          ),
          systemPrompt,
        );
        const retried = parseJsonStrict(retryText);
        const retriedPartial = this.buildAuthenticatedFull(
          retried,
          authPages,
          current as Record<string, any>,
        );
        (retriedPartial as any).version = currentVersion;
        (retriedPartial as any).meta = {
          ...((retriedPartial as any)?.meta || {}),
          version: currentVersion,
        };
        const retryValidation = validateContractJson(retriedPartial);
        if (!retryValidation.valid) {
          this.recordFailure();
          return this.fallbackSafe(current as Record<string, any>, params);
        }
        this.recordSuccess();
        const nextVersion = this.bumpPatch(currentVersion);
        // Finalize version in both top-level and meta
        (retriedPartial as any).version = nextVersion;
        (retriedPartial as any).meta = {
          ...((retriedPartial as any)?.meta || {}),
          version: nextVersion,
        };
        return { version: nextVersion, json: retriedPartial, llmDebug: { userPrompt, systemPrompt, rawResponse: retryText, request: retryReq } };
      }

      this.recordSuccess();
      const nextVersion = this.bumpPatch(currentVersion);
      // Finalize version in both top-level and meta
      (fullJson as any).version = nextVersion;
      (fullJson as any).meta = {
        ...((fullJson as any)?.meta || {}),
        version: nextVersion,
      };
      return { version: nextVersion, json: fullJson, llmDebug: { userPrompt, systemPrompt, rawResponse: text, request } };
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
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
      },
    };
    const res = await ai.models.generateContent(req);
    const text =
      (res && (res.text || res.candidates?.[0]?.content?.parts?.[0]?.text)) ||
      '';
    return text;
  }

  // Contract-specific Gemini call with explicit JSON schema and debug capture
  private async callGeminiContractWithDebug(
    userPrompt: string,
    systemPrompt: string,
  ): Promise<{ text: string; request: any }> {
    const model = this.config.get<string>('llm.gemini.model') || 'gemini-2.5-pro';
    const ai: any = (this.gemini as any)['ai'];
    if (!ai) throw new Error('Gemini client not initialized.');
    const req: any = {
      model,
      systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 16384,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            version: { type: 'string' },
            meta: {
              type: 'object',
              properties: {
                optimizationExplanation: { type: 'string' },
                isPartial: { type: 'boolean' },
                generatedAt: { type: 'string' },
                version: { type: 'string' },
              },
              required: ['optimizationExplanation', 'isPartial', 'generatedAt'],
            },
            pagesUI: {
              type: 'object',
              properties: {
                pages: { type: 'object' },
              },
              required: ['pages'],
            },
            thresholds: {
              type: 'object',
              additionalProperties: { type: 'number' },
            },
          },
          required: ['version', 'meta', 'pagesUI', 'thresholds'],
        },
      },
    };
    const res = await ai.models.generateContent(req);
    const text =
      (res && (res.text || res.candidates?.[0]?.content?.parts?.[0]?.text)) ||
      '';
    return { text, request: req };
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
      const defaultThresholds = {
        rageThreshold: 3,
        rageWindowMs: 1000,
        repeatThreshold: 3,
        repeatWindowMs: 2000,
        formRepeatWindowMs: 10000,
        formFailWindowMs: 10000,
      } as Record<string, number>;
      const json = {
        meta: {
          ...(((current as any)?.meta as any) || {}),
          optimizationExplanation:
            'Heuristic partial (authenticated pages) due to provider unavailability',
          isPartial: true,
          generatedAt: new Date().toISOString(),
        },
        thresholds: defaultThresholds,
        pagesUI: { pages: filtered },
      } as Record<string, unknown>;
      const nextVersion = this.bumpPatch(
        params.version ||
          (await this.contractService.findLatestByUser(params.userId))
            ?.version ||
          '0.1.0',
      );
      (json as any).version = nextVersion;
      (json as any).meta = { ...((json as any).meta || {}), version: nextVersion };
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
    const defaultThresholds = {
      rageThreshold: 3,
      rageWindowMs: 1000,
      repeatThreshold: 3,
      repeatWindowMs: 2000,
      formRepeatWindowMs: 10000,
      formFailWindowMs: 10000,
    } as Record<string, number>;
    const json = {
      meta: {
        optimizationExplanation: 'Fallback due to validation failure',
        isPartial: true,
        generatedAt: new Date().toISOString(),
      },
      thresholds: defaultThresholds,
      pagesUI: { pages: filtered },
    };
    const nextVersion = this.bumpPatch(params.version || '0.1.0');
    (json as any).version = nextVersion;
    (json as any).meta = { ...((json as any).meta || {}), version: nextVersion };
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

  // Helper: build partial authenticated-only contract from LLM output,
  // and fallback to base contract's authenticated pages if LLM returns none.
  private buildAuthenticatedPartial(
    llmOutput: Record<string, any>,
    authPages: Set<string>,
    baseContract?: Record<string, any>,
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

    // Fallback: if LLM output doesn't include any pages, copy from base contract
    if (Object.keys(filtered).length === 0 && baseContract) {
      const basePages = (baseContract as any)?.pagesUI?.pages || {};
      Object.entries(basePages || {}).forEach(([name, page]) => {
        if (authPages.has(name)) {
          filtered[name] = page;
        }
      });
    }

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

  // Helper: build full authenticated-only contract and include thresholds fallback.
  private buildAuthenticatedFull(
    llmOutput: Record<string, any>,
    authPages: Set<string>,
    baseContract?: Record<string, any>,
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

    // Fallback: if LLM output doesn't include any pages, copy from base contract
    if (Object.keys(filtered).length === 0 && baseContract) {
      const basePages = (baseContract as any)?.pagesUI?.pages || {};
      Object.entries(basePages || {}).forEach(([name, page]) => {
        if (authPages.has(name)) {
          filtered[name] = page;
        }
      });
    }

    const defaultThresholds = {
      rageThreshold: 3,
      rageWindowMs: 1000,
      repeatThreshold: 3,
      repeatWindowMs: 2000,
      formRepeatWindowMs: 10000,
      formFailWindowMs: 10000,
    } as Record<string, number>;

    const thresholdsRaw = (llmOutput as any)?.thresholds;
    const thresholds =
      thresholdsRaw && typeof thresholdsRaw === 'object' ? thresholdsRaw : defaultThresholds;

    return {
      meta: {
        ...((llmOutput as any)?.meta || {}),
        optimizationExplanation:
          ((llmOutput as any)?.meta?.optimizationExplanation || 'Generated by Gemini'),
        isPartial: false,
        generatedAt: new Date().toISOString(),
      },
      thresholds,
      pagesUI: { pages: filtered },
    };
  }
  
  async analyzeEventsForUser(
    userId: string,
    opts?: { since?: Date; limit?: number },
  ): Promise<{
    painPoints: Array<{ title: string; description: string; elementId?: string; page?: string; severity: 'low' | 'medium' | 'high' }>;
    improvements: Array<{ title: string; description: string; elementId?: string; page?: string; priority: 'low' | 'medium' | 'high' }>;
    eventCount: number;
    timestamp: string;
    message?: string;
  }> {
    const since = opts?.since || new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const limit = opts?.limit || 100;
    let events = await this.eventService.getRecentEvents(userId, since, limit);
    let eventCount = events.length;
    const timestamp = new Date().toISOString();
    if (eventCount === 0) {
      events = await this.eventService.getRecentEvents(userId, new Date(0), limit);
      eventCount = events.length;
      if (eventCount === 0) {
        return {
          painPoints: [],
          improvements: [],
          eventCount,
          timestamp,
          message: 'No events found for this user.',
        };
      }
    }

    const constraints = [
      'Return only JSON with painPoints and improvements arrays, each max length 5.',
      'Ground insights strictly in provided events; avoid hallucination.',
      'When context.eventCount > 0, include AT LEAST 1 painPoint and 1 improvement (never return empty arrays).',
      'Deduplicate signals by (elementId + page + event type); consolidate repeated patterns.',
      'Severity mapping: rage-click=high; error=high; form-abandonment=high; long-dwell=medium; other=medium by default.',
      'Each item should be concise: short actionable title and one-sentence description.',
      'Prefer using elementId and page from events; if unavailable, omit those fields (do not invent IDs).',
      'Do not include code, markdown, or commentary — JSON only.',
    ];

    const userPrompt = JSON.stringify({
      task:
        'Analyze tracking events to identify top UX pain points tied to specific components/pages AND propose targeted improvements that address or mitigate those issues.',
      format: 'JSON only',
      schema: {
        painPoints: [
          {
            title: 'string',
            description: 'string',
            elementId: 'string?',
            page: 'string?',
            severity: 'low|medium|high',
          },
        ],
        improvements: [
          {
            title: 'string',
            description: 'string',
            elementId: 'string?',
            page: 'string?',
            priority: 'low|medium|high',
          },
        ],
      },
      constraints,
      context: { userId, eventCount },
      events,
    });
    const model = this.config.get<string>('llm.gemini.model') || 'gemini-2.5-flash';
    const systemPrompt = buildSystemPrompt(model);
    try {
      const text = await this.callGemini(userPrompt, systemPrompt);
      const json = parseJsonStrict(text);
      if (!json || !Array.isArray(json.painPoints) || !Array.isArray(json.improvements)) {
        throw new Error('LLM output invalid: expected painPoints and improvements arrays');
      }
      const asSev = (s: any): 'low' | 'medium' | 'high' =>
        s === 'low' || s === 'medium' || s === 'high' ? s : 'medium';
      const asPrio = (s: any): 'low' | 'medium' | 'high' =>
        s === 'low' || s === 'medium' || s === 'high' ? s : 'medium';
      const painPoints = (json.painPoints as any[]).slice(0, 5).map((pp) => ({
        title: String(pp.title || ''),
        description: String(pp.description || ''),
        elementId: pp.elementId ? String(pp.elementId) : undefined,
        page: pp.page ? String(pp.page) : undefined,
        severity: asSev(pp.severity),
      }));
      const improvements = (json.improvements as any[]).slice(0, 5).map((im) => ({
        title: String(im.title || ''),
        description: String(im.description || ''),
        elementId: im.elementId ? String(im.elementId) : undefined,
        page: im.page ? String(im.page) : undefined,
        priority: asPrio(im.priority),
      }));
      return {
        painPoints,
        improvements,
        eventCount,
        timestamp,
      };
    } catch (err) {
      const improvementsFallback: Array<{
        title: string;
        description: string;
        elementId?: string;
        page?: string;
        priority: 'low' | 'medium' | 'high';
      }> = [
        {
          title: 'Instrument key user journeys',
          description:
            'Add tracking for onboarding, checkout, and error flows to enable meaningful analysis.',
          priority: 'high',
        },
        {
          title: 'Improve error feedback',
          description:
            'Ensure clear error messages and retry guidance for forms and network failures.',
          priority: 'medium',
        },
        {
          title: 'Clarify navigation and CTAs',
          description:
            'Use consistent labels and visual hierarchy for primary actions; avoid ambiguous buttons.',
          priority: 'medium',
        },
        {
          title: 'Add loading and empty states',
          description:
            'Provide skeletons/spinners and helpful empty-state copy to reduce confusion.',
          priority: 'low',
        },
      ];
      return {
        painPoints: [],
        improvements: improvementsFallback,
        eventCount,
        timestamp,
        message:
          eventCount === 0
            ? 'No events found; returned general improvements.'
            : 'Provider unavailable; returned heuristic improvements.',
      };
    }
  }
}
