import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserContractDto {
  @ApiProperty()
  version: string;

  @ApiProperty({
    type: 'object',
    description: 'Canonical contract JSON',
    additionalProperties: true,
  })
  json: Record<string, unknown>;

  @ApiProperty({
    type: 'object',
    required: false,
    description: 'Optional metadata',
    additionalProperties: true,
  })
  meta?: Record<string, unknown>;
}
