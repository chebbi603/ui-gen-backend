import { ApiProperty } from '@nestjs/swagger';

export class UserPersonalizedContractDto {
  @ApiProperty({
    type: 'object',
    required: false,
    description: 'Personalized contract JSON',
    additionalProperties: true,
  })
  json?: Record<string, unknown> | null;
}
