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
import { EnqueueAnalyzeEventsJobDto } from '../dto/analyze-events-job.dto';
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
    const { userId, priority, baseContract, version } = body as any;
    const uid = userId;
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
        baseContract,
        version,
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
    const { userId } = body || ({} as any);
    const uid = userId;
    if (!uid || typeof uid !== 'string') {
      throw new BadRequestException('userId required');
    }
    try {
      const res = await this.geminiService.analyzeEventsForUser(uid);
      return res;
    } catch (err) {
      throw err;
    }
  }

  @Post('analyze-events/job')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiBody({ type: EnqueueAnalyzeEventsJobDto })
  @ApiResponse({ status: 202, description: 'Job enqueued.', type: EnqueueJobResponseDto })
  async enqueueAnalyzeEvents(
    @Body() body: EnqueueAnalyzeEventsJobDto,
  ): Promise<EnqueueJobResponseDto> {
    const { userId, priority, since, limit } = body as any;
    const uid = userId;
    const user = await this.userService.findOne(uid);
    if (!user) {
      throw new NotFoundException('userId invalid');
    }
    // Circuit breaker open => reject
    if (this.geminiService.isCircuitOpen()) {
      throw new ServiceUnavailableException('LLM service temporarily unavailable');
    }
    try {
      const jobId = await this.queueService.addAnalyzeEventsJob({ userId: uid, priority, since, limit });
      return { jobId, message: 'Accepted' };
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('Queue not initialized')) {
        throw new ServiceUnavailableException('Queue not available');
      }
      throw err;
    }
  }

  @Get('analyze-events/jobs/:jobId')
  @ApiResponse({ status: 200, description: 'Analyze-events job status.', type: GeminiJobStatusDto })
  @ApiResponse({ status: 404, description: 'Job not found.' })
  async getAnalyzeJobStatus(@Param('jobId') jobId: string): Promise<GeminiJobStatusDto> {
    const status = await this.queueService.getAnalyzeJobStatus(jobId);
    if (!status) {
      throw new NotFoundException('job not found');
    }
    return status as GeminiJobStatusDto;
  }
}
