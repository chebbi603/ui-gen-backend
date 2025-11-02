import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GenerateContractRequestDto {
  @ApiProperty({ description: 'Target user id', required: false })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiProperty({ description: 'Alias for user id', required: false })
  @IsString()
  @IsOptional()
  _id?: string;

  @ApiProperty({ description: 'Alias for user id', required: false })
  @IsString()
  @IsOptional()
  id?: string;

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
