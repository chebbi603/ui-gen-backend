import { ApiProperty } from '@nestjs/swagger';

export class CreateContractDto {
  @ApiProperty({ description: 'Contract version (semver)' })
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
