import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateSessionDto {
  @ApiProperty({ description: 'Contract version at session start' })
  @IsString()
  contractVersion: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  deviceInfo?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  platform?: string;
}