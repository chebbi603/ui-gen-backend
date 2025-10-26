import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

export class EventDto {
  @IsDateString()
  timestamp: string;

  @IsString()
  componentId: string;

  @IsEnum(['tap', 'view', 'input'])
  eventType: 'tap' | 'view' | 'input';

  @IsObject()
  @IsOptional()
  data?: Record<string, any>;
}

export class CreateEventsBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EventDto)
  events: EventDto[];
}