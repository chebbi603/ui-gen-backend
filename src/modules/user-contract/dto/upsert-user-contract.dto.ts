import { ApiProperty } from '@nestjs/swagger';

export class UpsertUserContractDto {
  @ApiProperty({
    required: false,
    description: 'Optional canonical contract id to link personalization',
  })
  contractId?: string;

  @ApiProperty({
    type: 'object',
    description: 'Personalized contract JSON',
    additionalProperties: true,
  })
  json: Record<string, unknown>;
}
