import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
  SetMetadata,
} from '@nestjs/common';
import { ContractService } from '../services/contract.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateContractDto } from '../dto/create-contract.dto';
import { ContractDto } from '../dto/contract.dto';
import { RoleGuard } from '../../auth/guards/role-auth.guard';

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
    const doc = await this.contractService.create(
      json,
      version,
      meta,
      req.user.userId,
    );
    const createdAt = (doc as any).createdAt as Date | undefined;
    const updatedAt = (doc as any).updatedAt as Date | undefined;
    return {
      id: (doc as any)._id?.toString?.() || '',
      userId: (doc as any).userId?.toString?.() || '',
      version: (doc as any).version,
      json: (doc as any).json as Record<string, unknown>,
      createdAt: createdAt ? createdAt.toISOString() : new Date().toISOString(),
      updatedAt: updatedAt ? updatedAt.toISOString() : new Date().toISOString(),
      meta: (doc as any).meta ?? {},
    } as ContractDto;
  }

  @Get(':id')
  @ApiResponse({
    status: 200,
    description: 'Get contract by id.',
    type: ContractDto,
  })
  async getById(@Param('id') id: string) {
    const doc = await this.contractService.findById(id);
    const createdAt = (doc as any).createdAt as Date | undefined;
    const updatedAt = (doc as any).updatedAt as Date | undefined;
    return {
      id: (doc as any)._id?.toString?.() || '',
      userId: (doc as any).userId?.toString?.() || '',
      version: (doc as any).version,
      json: (doc as any).json as Record<string, unknown>,
      createdAt: createdAt ? createdAt.toISOString() : new Date().toISOString(),
      updatedAt: updatedAt ? updatedAt.toISOString() : new Date().toISOString(),
      meta: (doc as any).meta ?? {},
    } as ContractDto;
  }

  @SetMetadata('roles', ['ADMIN'])
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Get(':id/history')
  @ApiResponse({ status: 200, description: 'Contract history.' })
  async getHistory(@Param('id') id: string) {
    const list = await this.contractService.findHistoryByContractId(id);
    // Compute diffs between consecutive versions
    const items = [] as any[];
    let prev: any = null;
    for (const doc of list) {
      const createdAt = (doc as any).createdAt as Date | undefined;
      const updatedAt = (doc as any).updatedAt as Date | undefined;
      const currJson = (doc as any).json as Record<string, unknown>;
      const diff = prev ? computeJsonDiff(prev, currJson) : null;
      items.push({
        id: (doc as any)._id?.toString?.() || '',
        userId: (doc as any).userId?.toString?.() || '',
        version: (doc as any).version,
        json: currJson,
        createdAt: createdAt ? createdAt.toISOString() : new Date().toISOString(),
        updatedAt: updatedAt ? updatedAt.toISOString() : new Date().toISOString(),
        meta: (doc as any).meta ?? {},
        diff,
      });
      prev = currJson;
    }
    return items;
  }
}

function computeJsonDiff(prev: Record<string, any>, curr: Record<string, any>) {
  const added: Record<string, any> = {};
  const removed: string[] = [];
  const updated: Record<string, { from: any; to: any }> = {};
  const prevKeys = new Set(Object.keys(prev || {}));
  const currKeys = new Set(Object.keys(curr || {}));
  for (const key of currKeys) {
    if (!prevKeys.has(key)) {
      added[key] = curr[key];
    } else if (JSON.stringify(prev[key]) !== JSON.stringify(curr[key])) {
      updated[key] = { from: prev[key], to: curr[key] };
    }
  }
  for (const key of prevKeys) {
    if (!currKeys.has(key)) removed.push(key);
  }
  return { added, removed, updated };
}
