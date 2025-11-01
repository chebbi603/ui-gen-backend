import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class AggregateQueryDto {
  @ApiProperty({ description: 'Page name to analyze' })
  @IsString()
  page: string;

  @ApiProperty({ description: 'Time range filter', required: false, enum: ['24h', '7d', '30d', 'all'], default: 'all' })
  @IsOptional()
  @IsString()
  @IsIn(['24h', '7d', '30d', 'all'])
  timeRange?: '24h' | '7d' | '30d' | 'all';

  @ApiProperty({ description: 'Optional event type filter', required: false })
  @IsOptional()
  @IsString()
  eventType?: string;
}