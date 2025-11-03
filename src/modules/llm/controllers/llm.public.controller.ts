import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LlmService } from '../services/llm.service';
import { GenerateContractRequestDto } from '../dto/generate-contract.dto';

@ApiTags('llm')
@Controller('llm/public')
export class LlmPublicController {
  constructor(private readonly llmService: LlmService) {}

  @Post('generate-contract')
  @ApiBody({ type: GenerateContractRequestDto })
  @ApiResponse({ status: 201, description: 'Optimized contract (preview).' })
  async generateContractPreview(@Body() body: any) {
    const { userId, baseContract, version } = body || ({} as any);
    const uid = userId;
    const { json, version: nextVersion } =
      await this.llmService.generateOptimizedContract({
        userId: uid,
        baseContract,
        version,
      });
    return {
      userId: uid,
      version: nextVersion,
      json,
    };
  }
}