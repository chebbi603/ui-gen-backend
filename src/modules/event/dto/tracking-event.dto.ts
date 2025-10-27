import { ApiProperty } from '@nestjs/swagger';

export class TrackingEventDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  eventType: string;

  @ApiProperty({ description: 'ISO timestamp' })
  timestamp: string;

  @ApiProperty({ required: false })
  page?: string;

  @ApiProperty({ required: false })
  component?: string;

  @ApiProperty({ type: 'object', required: false, additionalProperties: true })
  payload?: Record<string, unknown>;

  @ApiProperty({ required: false })
  sessionId?: string;
}
