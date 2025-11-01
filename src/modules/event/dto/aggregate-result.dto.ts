import { ApiProperty } from '@nestjs/swagger';

export class ComponentCountDto {
  @ApiProperty()
  componentId: string;

  @ApiProperty()
  count: number;
}

export class ErrorMessageCountDto {
  @ApiProperty()
  message: string;

  @ApiProperty()
  count: number;
}

export class RageClickDto {
  @ApiProperty()
  componentId: string;

  @ApiProperty({ description: 'Number of 1s windows with ≥3 taps' })
  occurrences: number;
}

export class AggregateResultDto {
  @ApiProperty()
  page: string;

  @ApiProperty({ required: false })
  timeframeStart?: string;

  @ApiProperty()
  timeframeEnd: string;

  @ApiProperty()
  totalEvents: number;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' } })
  eventTypeCounts: Record<string, number>;

  @ApiProperty()
  uniqueUsers: number;

  @ApiProperty({ required: false })
  averageSessionDurationSec?: number;

  @ApiProperty({ type: [ComponentCountDto] })
  topComponents: ComponentCountDto[];

  @ApiProperty()
  errorRatePercent: number;

  @ApiProperty({ type: [ErrorMessageCountDto] })
  topErrorMessages: ErrorMessageCountDto[];

  @ApiProperty({ type: [RageClickDto] })
  rageClickComponents: RageClickDto[];
}