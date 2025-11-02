import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
} from '@nestjs/common';
import { ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserContractService } from '../services/user-contract.service';
import { UpsertUserContractDto } from '../dto/upsert-user-contract.dto';
import { UserPersonalizedContractDto } from '../dto/user-personalized-contract.dto';

@ApiTags('user-contracts')
@Controller('contracts/user')
export class UserContractController {
  constructor(private readonly userContractService: UserContractService) {}

  @Get(':userId')
  @ApiResponse({
    status: 200,
    description: 'Get user personalized contract.',
    type: UserPersonalizedContractDto,
  })
  async getUserContract(@Param('userId') userId: string) {
    const doc = await this.userContractService.getUserContract(userId);
    return doc || { json: null };
  }

  @Post(':userId')
  @ApiBody({ type: UpsertUserContractDto })
  @ApiResponse({
    status: 201,
    description: 'Upsert user personalized contract.',
    type: UserPersonalizedContractDto,
  })
  async upsertUserContract(
    @Param('userId') userId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    const { contractId, json } = body;
    return this.userContractService.upsertUserContract(
      userId,
      contractId,
      json,
      req?.user?.userId ?? process.env.PUBLIC_EVENTS_USER_ID ?? '000000000000000000000000',
      'ADMIN',
    );
  }
}
