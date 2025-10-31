import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LlmService } from '../services/llm.service';
import { ContractService } from '../../contract/services/contract.service';
import { GenerateContractRequestDto } from '../dto/generate-contract.dto';
import { ContractDto } from '../../contract/dto/contract.dto';

@ApiTags('llm')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard)
@Controller('llm')
export class LlmController {
  constructor(
    private readonly llmService: LlmService,
    private readonly contractService: ContractService,
  ) {}

  @Post('generate-contract')
  @ApiBody({ type: GenerateContractRequestDto })
  @ApiResponse({
    status: 201,
    description: 'Optimized contract generated.',
    type: ContractDto,
  })
  async generateContract(@Body() body: any, @Request() req: any) {
    const { userId, baseContract, version } = body;
    const { json, version: nextVersion } =
      await this.llmService.generateOptimizedContract({
        userId,
        baseContract,
        version,
      });
    const doc = await this.contractService.create(
      json,
      nextVersion,
      { optimizedBy: req.user.userId },
      req.user.userId,
      userId,
    );
    const createdAt = (doc as any).createdAt as Date | undefined;
    const updatedAt = (doc as any).updatedAt as Date | undefined;
    return {
      id: (doc as any)._id?.toString?.() || '',
      userId,
      version: (doc as any).version,
      json: (doc as any).json as Record<string, unknown>,
      createdAt: createdAt ? createdAt.toISOString() : new Date().toISOString(),
      updatedAt: updatedAt ? updatedAt.toISOString() : new Date().toISOString(),
      meta: (doc as any).meta ?? {},
    };
  }
}
