import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class GenerateContractRequestDto {
  @ApiProperty({ description: 'Target user id', required: true })
  @IsString()
  userId!: string;

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
