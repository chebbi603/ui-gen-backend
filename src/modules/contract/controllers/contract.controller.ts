import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ContractService } from '../services/contract.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateContractDto } from '../dto/create-contract.dto';
import { ContractDto } from '../dto/contract.dto';

@ApiTags('contracts')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard)
@Controller('contracts')
export class ContractController {
  constructor(private readonly contractService: ContractService) {}

  @Post()
  @ApiBody({ type: CreateContractDto })
  @ApiResponse({
    status: 201,
    description: 'Contract created.',
    type: ContractDto,
  })
  async create(@Body() body: any, @Request() req: any) {
    const { json, version, meta } = body;
    return this.contractService.create(json, version, meta, req.user.userId);
  }

  @Get(':id')
  @ApiResponse({
    status: 200,
    description: 'Get contract by id.',
    type: ContractDto,
  })
  async getById(@Param('id') id: string) {
    return this.contractService.findById(id);
  }
}
