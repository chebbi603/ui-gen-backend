import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min } from 'class-validator';

export class EnqueueGeminiJobDto {
  @ApiProperty({ description: 'Target user id', example: '64fa0c...' })
  @IsString()
  userId: string;

  @ApiProperty({ description: 'Optional priority (1 highest)', required: false, example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  priority?: number;
}

export class GeminiJobStatusDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: ['pending', 'processing', 'completed', 'failed', 'unknown'] })
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'unknown';
  @ApiProperty() progress: number;
  @ApiProperty({ required: false }) result?: any;
  @ApiProperty({ required: false }) error?: string | null;
  @ApiProperty({ type: 'object' })
  timestamps: { createdAt?: string; startedAt?: string; completedAt?: string };
}

export class EnqueueJobResponseDto {
  @ApiProperty({ description: 'Job id' }) jobId: string;
  @ApiProperty({ description: 'Message', example: 'Accepted' }) message: string;
}

export class CircuitBreakerResetResponseDto {
  @ApiProperty({ description: 'Circuit breaker reset success' }) success: boolean;
}