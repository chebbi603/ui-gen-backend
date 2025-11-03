import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, IsISO8601 } from 'class-validator';

export class EnqueueAnalyzeEventsJobDto {
  @ApiProperty({ description: 'Target user id', example: '64fa0c...', required: true })
  @IsString()
  userId!: string;

  @ApiProperty({ description: 'ISO start time for events window', required: false, example: '2025-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  since?: string;

  @ApiProperty({ description: 'Max events to analyze', required: false, example: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiProperty({ description: 'Optional priority (1 highest)', required: false, example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  priority?: number;
}