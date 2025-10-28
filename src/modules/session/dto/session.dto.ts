import { ApiProperty } from '@nestjs/swagger';

export class SessionDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ description: 'ISO timestamp' })
  startedAt: string;

  @ApiProperty({ description: 'ISO timestamp', required: false })
  endedAt?: string;

  @ApiProperty({ required: false })
  deviceInfo?: string;

  @ApiProperty()
  contractVersion: string;

  @ApiProperty({ required: false })
  platform?: string;
}