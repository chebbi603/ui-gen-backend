import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AnalyzeEventsRequestDto {
  @ApiProperty({ description: 'Target user id (Mongo ObjectId)', required: true, example: '64fa0c...' })
  @IsString()
  userId!: string;
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