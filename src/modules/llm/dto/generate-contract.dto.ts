import { ApiProperty } from '@nestjs/swagger';

export class GenerateContractRequestDto {
  @ApiProperty()
  userId: string;

  @ApiProperty({
    type: 'object',
    required: false,
    description: 'Optional base contract JSON',
    additionalProperties: true,
  })
  baseContract?: Record<string, unknown>;

  @ApiProperty({ required: false, description: 'Starting version (semver)' })
  version?: string;
}
