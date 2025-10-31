import { ApiProperty } from '@nestjs/swagger';

export class ContractDto {
  @ApiProperty({ description: 'Contract id' })
  id: string;

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

  @ApiProperty({ type: 'object', required: false, additionalProperties: true })
  meta?: Record<string, unknown>;
}
