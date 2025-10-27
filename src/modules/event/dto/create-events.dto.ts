import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class EventDto {
  @IsDateString()
  timestamp: string;

  @IsString()
  @IsOptional()
  page?: string;

  @IsString()
  componentId: string;

  @IsEnum(['tap', 'view', 'input', 'navigate', 'error', 'form-fail'])
  eventType: 'tap' | 'view' | 'input' | 'navigate' | 'error' | 'form-fail';

  @IsObject()
  @IsOptional()
  data?: Record<string, any>;

  @IsString()
  @IsOptional()
  sessionId?: string;
}

export class CreateEventsBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EventDto)
  events: EventDto[];
}
