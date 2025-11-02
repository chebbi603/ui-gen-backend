import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ServiceUnavailableException,
  NotFoundException,
  BadRequestException,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';
import { QueueService } from '../queue.service';
import {
  CircuitBreakerResetResponseDto,
  EnqueueGeminiJobDto,
  EnqueueJobResponseDto,
  GeminiJobStatusDto,
} from '../dto/gemini-job.dto';
import { UserService } from '../../user/services/user.service';
import { GeminiService } from '../../llm/services/gemini.service';
import { EventService } from '../../event/services/event.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  AnalyzeEventsRequestDto,
  AnalyzeEventsResponseDto,
  ImprovementDto,
} from '../dto/analyze-events.dto';
import { buildSystemPrompt } from '../../llm/prompts/gemini.prompts';
import { parseJsonStrict } from '../../llm/utils/json';
import { ConfigService } from '@nestjs/config';

@ApiTags('Gemini')
@Controller('gemini')
export class GeminiController {
  constructor(
    private readonly queueService: QueueService,
    private readonly userService: UserService,
    private readonly geminiService: GeminiService,
    private readonly eventService: EventService,
    private readonly config: ConfigService,
  ) {}

  @Post('generate-contract')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiBody({ type: EnqueueGeminiJobDto })
  @ApiResponse({
    status: 202,
    description: 'Job enqueued.',
    type: EnqueueJobResponseDto,
  })
  async enqueueGeneration(
    @Body() body: EnqueueGeminiJobDto,
    @Request() req: any,
  ): Promise<EnqueueJobResponseDto> {
    const { userId, _id, id, priority } = body as any;
    const uid = userId || _id || id;
    const user = await this.userService.findOne(uid);
    if (!user) {
      throw new NotFoundException('userId invalid');
    }
    // Circuit breaker open => reject
    if (this.geminiService.isCircuitOpen()) {
      throw new ServiceUnavailableException(
        'LLM service temporarily unavailable',
      );
    }
    try {
      const jobId = await this.queueService.addGeminiGenerationJob({
        userId: uid,
        priority,
      });
      return { jobId, message: 'Accepted' };
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('Queue not initialized')) {
        throw new ServiceUnavailableException('Queue not available');
      }
      throw err;
    }
  }

  @Get('jobs/:jobId')
  @ApiResponse({
    status: 200,
    description: 'Job status.',
    type: GeminiJobStatusDto,
  })
  @ApiResponse({ status: 404, description: 'Job not found.' })
  async getJobStatus(
    @Param('jobId') jobId: string,
  ): Promise<GeminiJobStatusDto> {
    const status = await this.queueService.getGeminiJobStatus(jobId);
    if (!status) {
      throw new NotFoundException('job not found');
    }
    return status as GeminiJobStatusDto;
  }

  @Post('circuit-breaker/reset')
  @ApiResponse({
    status: 200,
    description: 'Circuit breaker reset.',
    type: CircuitBreakerResetResponseDto,
  })
  async resetCircuitBreaker(): Promise<CircuitBreakerResetResponseDto> {
    this.geminiService.resetCircuitBreaker();
    return { success: true };
  }
  @Post('analyze-events')
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: AnalyzeEventsRequestDto })
  @ApiResponse({
    status: 200,
    description: 'UX pain points from recent events.',
    type: AnalyzeEventsResponseDto,
  })
  async analyzeEvents(
    @Body() body: AnalyzeEventsRequestDto,
  ): Promise<AnalyzeEventsResponseDto> {
    const { _id, id } = body || ({} as any);
    const uid = _id || id;
    if (!uid || typeof uid !== 'string') {
      throw new BadRequestException('id or _id required');
    }
    const now = Date.now();
    const since = new Date(now - 7 * 24 * 3600 * 1000);
    let events = await this.eventService.getRecentEvents(uid, since, 100);
    let eventCount = events.length;
    const timestamp = new Date().toISOString();
    if (eventCount === 0) {
      // Widen window to all available events (limited)
      events = await this.eventService.getRecentEvents(uid, new Date(0), 100);
      eventCount = events.length;
      // If still none, do not call LLM; return empty analysis
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
      'Return only JSON with painPoints and improvements arrays, each max length 5',
      'Ground insights in provided events; avoid hallucination',
    ];

    const userPrompt = JSON.stringify({
      task: 'Analyze mobile app tracking events and identify top UX pain points AND top UX improvements (nice-to-haves).',
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
      context: { userId: uid, eventCount },
      events,
    });
    const model =
      this.config.get<string>('llm.gemini.model') || 'gemini-2.5-flash';
    const systemPrompt = buildSystemPrompt(model);
    try {
      const text = await this.geminiService.callGemini(
        userPrompt,
        systemPrompt,
      );
      const json = parseJsonStrict(text);
      if (
        !json ||
        !Array.isArray(json.painPoints) ||
        !Array.isArray(json.improvements)
      ) {
        throw new BadRequestException(
          'LLM output invalid: expected painPoints and improvements arrays',
        );
      }
      return {
        painPoints: json.painPoints,
        improvements: json.improvements,
        eventCount,
        timestamp,
      };
    } catch (err) {
      // Safe fallback: if provider is unavailable or output invalid, return heuristic improvements when possible
      const improvementsFallback: ImprovementDto[] = [
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
