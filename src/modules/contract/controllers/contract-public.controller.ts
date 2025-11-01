import { Controller, Get, Header } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractService } from '../services/contract.service';
import { ContractDto } from '../dto/contract.dto';
import { CacheService } from '../../../common/services/cache.service';
import { FlutterContractFilterService } from '../services/flutter-contract-filter.service';

@ApiTags('contracts')
@Controller('contracts')
export class ContractPublicController {
  constructor(
    private readonly contractService: ContractService,
    private readonly cache: CacheService,
    private readonly flutterFilter: FlutterContractFilterService,
  ) {}

  @Get('canonical')
  @Header('Cache-Control', 'public, max-age=300')
  @ApiResponse({ status: 200, description: 'Latest canonical contract.', type: ContractDto })
  async getCanonical(): Promise<ContractDto | null> {
    const cacheKey = 'contracts:canonical';
    const cached = await this.cache.get<ContractDto>(cacheKey);
    if (cached) return cached;

    const doc = await this.contractService.findLatestCanonical();
    if (!doc) return null;
    const createdAt = (doc as any).createdAt as Date | undefined;
    const updatedAt = (doc as any).updatedAt as Date | undefined;
    const filteredJson = this.flutterFilter.filterForFlutter((doc as any).json as Record<string, unknown>);
    const res: ContractDto = {
      id: (doc as any)._id?.toString?.() || '',
      userId: '',
      version: (doc as any).version,
      json: filteredJson,
      createdAt: createdAt ? createdAt.toISOString() : new Date().toISOString(),
      updatedAt: updatedAt ? updatedAt.toISOString() : new Date().toISOString(),
      meta: (doc as any).meta ?? {},
    };
    await this.cache.set(cacheKey, res, 300);
    return res;
  }

  // Provide a non-conflicting alias under /contracts/public/canonical
  @Get('public/canonical')
  @Header('Cache-Control', 'public, max-age=300')
  @ApiResponse({ status: 200, description: 'Latest canonical contract (alias).', type: ContractDto })
  async getCanonicalAlias(): Promise<ContractDto | null> {
    return this.getCanonical();
  }
}