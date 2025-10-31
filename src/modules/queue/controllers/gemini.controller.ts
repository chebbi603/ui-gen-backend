import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ServiceUnavailableException,
  NotFoundException,
  Param,
  Post,
  Request,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../../auth/guards/role-auth.guard';
import { QueueService } from '../queue.service';
import {
  CircuitBreakerResetResponseDto,
  EnqueueGeminiJobDto,
  EnqueueJobResponseDto,
  GeminiJobStatusDto,
} from '../dto/gemini-job.dto';
import { UserService } from '../../user/services/user.service';
import { GeminiService } from '../../llm/services/gemini.service';

@ApiTags('Gemini')
@ApiBearerAuth('accessToken')
@Controller('gemini')
export class GeminiController {
  constructor(
    private readonly queueService: QueueService,
    private readonly userService: UserService,
    private readonly geminiService: GeminiService,
  ) {}

  @SetMetadata('roles', ['ADMIN'])
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Post('generate-contract')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiBody({ type: EnqueueGeminiJobDto })
  @ApiResponse({ status: 202, description: 'Job enqueued.', type: EnqueueJobResponseDto })
  async enqueueGeneration(@Body() body: EnqueueGeminiJobDto, @Request() req: any): Promise<EnqueueJobResponseDto> {
    const { userId, priority } = body;
    const user = await this.userService.findOne(userId);
    if (!user) {
      throw new NotFoundException('userId invalid');
    }
    // Circuit breaker open => reject
    if (this.geminiService.isCircuitOpen()) {
      throw new ServiceUnavailableException('LLM service temporarily unavailable');
    }
    try {
      const jobId = await this.queueService.addGeminiGenerationJob({ userId, priority });
      return { jobId, message: 'Accepted' };
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('Queue not initialized')) {
        throw new ServiceUnavailableException('Queue not available');
      }
      throw err;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('jobs/:jobId')
  @ApiResponse({ status: 200, description: 'Job status.', type: GeminiJobStatusDto })
  @ApiResponse({ status: 404, description: 'Job not found.' })
  async getJobStatus(@Param('jobId') jobId: string): Promise<GeminiJobStatusDto> {
    const status = await this.queueService.getGeminiJobStatus(jobId);
    if (!status) {
      throw new NotFoundException('job not found');
    }
    return status as GeminiJobStatusDto;
  }

  @SetMetadata('roles', ['ADMIN'])
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Post('circuit-breaker/reset')
  @ApiResponse({ status: 200, description: 'Circuit breaker reset.', type: CircuitBreakerResetResponseDto })
  async resetCircuitBreaker(): Promise<CircuitBreakerResetResponseDto> {
    this.geminiService.resetCircuitBreaker();
    return { success: true };
  }
}