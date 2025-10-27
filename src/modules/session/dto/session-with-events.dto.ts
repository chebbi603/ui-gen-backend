import { ApiProperty } from '@nestjs/swagger';
import { SessionDto } from './session.dto';
import { TrackingEventDto } from '../../event/dto/tracking-event.dto';

export class SessionWithEventsDto extends SessionDto {
  @ApiProperty({ type: TrackingEventDto, isArray: true })
  events: TrackingEventDto[];
}