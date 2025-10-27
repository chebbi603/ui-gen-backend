import { ApiProperty } from '@nestjs/swagger';

export class InsertedCountDto {
  @ApiProperty()
  inserted: number;
}
