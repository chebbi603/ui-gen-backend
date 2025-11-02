import {
  Body,
  Controller,
  Post,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractBuilderService } from '../services/contract-builder.service';
import { ContractService } from '../services/contract.service';
import { ContractDto } from '../dto/contract.dto';
import { validateContractJson } from '../../../common/validators/contract.validator';

@ApiTags('admin')
@Controller('admin')
export class AdminContractController {
  constructor(
    private readonly builder: ContractBuilderService,
    private readonly contracts: ContractService,
  ) {}

  /**
   * Generate and persist the canonical contract using the builder.
   * Returns the created record for frontend testing.
   */
  @Post('generate-canonical-contract')
  @ApiResponse({
    status: 201,
    description: 'Canonical contract generated.',
    type: ContractDto,
  })
  async generateCanonical(
    @Body() body: any,
    @Request() req: any,
  ): Promise<ContractDto> {
    const version = body?.version?.toString?.() || '1.0.0';
    const appName = body?.appName?.toString?.() || 'DynamicUXDemo';

    // Build pages
    const json = this.builder
      .startContract(appName, version, body?.themeTokens ?? {})
      .createPage('landing', 'Welcome', 'center', false)
      .addCard('Discover Your Personalized Experience')
      .addImage('landing_hero', 600, 300)
      .createPage('login', 'Sign In', 'center', false)
      .addCard('Welcome Back')
      .createPage('home', 'Home', 'scroll', true)
      .addList('home_list', [
        { title: 'Start here', subtitle: 'Quick onboarding' },
        { title: 'Browse content', subtitle: 'Music, podcasts, ebooks' },
      ])
      .createPage('music', 'Music', 'scroll', true)
      .addList('music_list')
      .createPage('podcasts', 'Podcasts', 'scroll', true)
      .addList('podcasts_list')
      .createPage('ebooks', 'Ebooks', 'scroll', true)
      .addList('ebooks_list')
      .build();

    // Validate (comprehensive validator)
    const validation = validateContractJson(json);
    if (!validation.valid) {
      throw new BadRequestException({
        message: 'Invalid generated contract',
        errors: validation.errors,
      });
    }

    // Persist canonical (no userId)
    const createdBy =
      req?.user?.userId ??
      process.env.PUBLIC_EVENTS_USER_ID ??
      '000000000000000000000000';
    const doc = await this.contracts.create(
      json,
      version,
      { source: 'builder', generatedBy: createdBy },
      createdBy,
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
}
