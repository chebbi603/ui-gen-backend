import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, IsObject } from 'class-validator';

export class EnqueueGeminiJobDto {
  @ApiProperty({ description: 'Target user id', example: '64fa0c...', required: true })
  @IsString()
  userId!: string;

  @ApiProperty({ description: 'Optional priority (1 highest)', required: false, example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  priority?: number;

  @ApiProperty({ description: 'Optional base contract JSON to guide optimization', required: false, type: 'object' })
  @IsOptional()
  @IsObject()
  baseContract?: Record<string, unknown>;

  @ApiProperty({ description: 'Optional base version to use as starting point', required: false, example: '0.1.0' })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiProperty({ description: 'Optional pain points list (currently ignored server-side)', required: false, isArray: true, type: 'object' })
  @IsOptional()
  painPoints?: any[];
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