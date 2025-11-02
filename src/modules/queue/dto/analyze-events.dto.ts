import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AnalyzeEventsRequestDto {
  @ApiProperty({ description: 'Target user `_id` (Mongo ObjectId)', required: false, example: '64fa0c...' })
  @IsString()
  @IsOptional()
  _id?: string;

  @ApiProperty({ description: 'Target user `id` (alias of `_id`)', required: false, example: '64fa0c...' })
  @IsString()
  @IsOptional()
  id?: string;
}

export class PainPointDto {
  @ApiProperty() title: string;
  @ApiProperty() description: string;
  @ApiProperty({ required: false }) elementId?: string;
  @ApiProperty({ required: false }) page?: string;
  @ApiProperty({ enum: ['low', 'medium', 'high'] }) severity: 'low' | 'medium' | 'high';
}

export class ImprovementDto {
  @ApiProperty() title: string;
  @ApiProperty() description: string;
  @ApiProperty({ required: false }) elementId?: string;
  @ApiProperty({ required: false }) page?: string;
  @ApiProperty({ enum: ['low', 'medium', 'high'] }) priority: 'low' | 'medium' | 'high';
}

export class AnalyzeEventsResponseDto {
  @ApiProperty({ type: [PainPointDto] })
  painPoints: PainPointDto[];

  @ApiProperty({ type: [ImprovementDto] })
  improvements: ImprovementDto[];

  @ApiProperty({ description: 'Number of events analyzed' })
  eventCount: number;

  @ApiProperty({ description: 'ISO timestamp of analysis' })
  timestamp: string;

  @ApiProperty({ required: false })
  message?: string;
}