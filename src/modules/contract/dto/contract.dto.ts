import { ApiProperty } from '@nestjs/swagger';

export class ContractDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  version: string;

  @ApiProperty({
    type: 'object',
    description: 'Canonical contract JSON',
    additionalProperties: true,
  })
  json: Record<string, unknown>;

  @ApiProperty({ description: 'ISO timestamp' })
  createdAt: string;

  @ApiProperty({ description: 'ISO timestamp' })
  updatedAt: string;
}
