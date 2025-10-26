import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserContractService } from '../services/user-contract.service';

@ApiTags('user-contracts')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard)
@Controller('contracts/user')
export class UserContractController {
  constructor(private readonly userContractService: UserContractService) {}

  @Get(':userId')
  @ApiResponse({ status: 200, description: 'Get user personalized contract.' })
  async getUserContract(@Param('userId') userId: string, @Request() req: any) {
    const doc = await this.userContractService.getUserContract(userId);
    return doc || { json: null };
  }

  @Post(':userId')
  @ApiBody({ schema: { properties: { contractId: { type: 'string' }, json: { type: 'object' } }, required: ['json'] } })
  @ApiResponse({ status: 201, description: 'Upsert user personalized contract.' })
  async upsertUserContract(@Param('userId') userId: string, @Body() body: any, @Request() req: any) {
    const { contractId, json } = body;
    return this.userContractService.upsertUserContract(userId, contractId, json, req.user.userId, req.user.role);
  }
}