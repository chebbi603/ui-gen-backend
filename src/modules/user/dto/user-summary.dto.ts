import { ApiProperty } from '@nestjs/swagger';

export class UserSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ required: false })
  name: string;

  @ApiProperty({ description: 'ISO timestamp' })
  lastActive: string;

  @ApiProperty()
  contractVersion: string;
}
