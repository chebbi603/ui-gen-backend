import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Delete,
  Request,
  Post,
  Header,
  NotFoundException,
} from '@nestjs/common';
import { UserService } from '../services/user.service';
import { UpdateUserDto } from '../dto/update-user.dto';
import { ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';
import { UserDto } from '../dto/user.dto';
import { ContractService } from '../../contract/services/contract.service';
import { EventService } from '../../event/services/event.service';
import { UserDTO, ContractDTO, TrackingEventDTO } from '../../../common/dto';
import { ContractDto } from '../../contract/dto/contract.dto';
import { UpdateUserContractDto } from '../dto/update-user-contract.dto';
import { TrackingEventDto } from '../../event/dto/tracking-event.dto';
import { UserSummaryDto } from '../dto/user-summary.dto';
import { CacheService } from '../../../common/services/cache.service';
import { ContractMergeService } from '../../contract/services/contract-merge.service';
import { FlutterContractFilterService } from '../../contract/services/flutter-contract-filter.service';

@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly contractService: ContractService,
    private readonly eventService: EventService,
    private readonly cache: CacheService,
    private readonly contractMerge: ContractMergeService,
    private readonly flutterFilter: FlutterContractFilterService,
  ) {}

  private readonly logger = new Logger(UserController.name);

  @Get('me')
  @ApiResponse({
    status: 200,
    description: 'Current user info.',
    type: UserDto,
  })
  me(@Request() req: any) {
    const uid = req?.user?.userId ?? process.env.PUBLIC_EVENTS_USER_ID ?? '000000000000000000000000';
    return this.userService.findOne(uid);
  }

  @Get()
  @ApiResponse({
    status: 200,
    description: 'List all users summary.',
    type: UserSummaryDto,
    isArray: true,
  })
  async findAll(): Promise<UserDTO[]> {
    const q = await this.userService.findAll();
    const res: UserDTO[] = [];
    for (const u of q) {
      const lastEvent = await this.eventService.getLastForUser(
        u._id.toString(),
      );
      const latestContract = await this.contractService.findLatestByUser(
        u._id.toString(),
      );
      res.push({
        id: u._id.toString(),
        name: u.name,
        lastActive: (lastEvent ?? (u as any).updatedAt)?.toISOString(),
        contractVersion: latestContract?.version ?? '',
      });
    }
    return res;
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  // Dashboard & Flutter: GET /users/{id}/contract
  @Get(':id/contract')
  @Header('Cache-Control', 'private, max-age=300')
  @ApiResponse({
    status: 200,
    description: 'Latest user contract.',
    type: ContractDto,
  })
  async getUserContract(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<ContractDTO | null> {
    // Ensure user exists
    const user = await this.userService.findOne(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    // Try cache first
    const cacheKey = `contracts:user:${id}`;
    const cached = await this.cache.get<ContractDTO>(cacheKey);
    if (cached) return cached;

    // Retrieve personalized and canonical contracts
    const personalized = await this.contractService.findLatestByUser(id);
    const canonical = await this.contractService.findLatestCanonical();
    if (!personalized && !canonical) return null;

    // If personalized exists, merge with canonical; else return canonical
    try {
      if (personalized && (personalized as any).userId) {
        const mergedJson = this.contractMerge.mergeContracts(
          (canonical as any)?.json ?? {},
          (personalized as any)?.json ?? {},
        );
        const createdAtCanon = (canonical as any)?.createdAt as Date | undefined;
        const updatedAtCanon = (canonical as any)?.updatedAt as Date | undefined;
        const filteredJson = this.flutterFilter.filterForFlutter(
          (mergedJson ?? {}) as Record<string, unknown>,
        );
        const res: ContractDTO = {
          id: (canonical as any)?._id?.toString?.() || '',
          userId: id,
          version: (canonical as any)?.version ?? (personalized as any)?.version,
          json: filteredJson,
          createdAt: createdAtCanon
            ? createdAtCanon.toISOString()
            : new Date().toISOString(),
          updatedAt: updatedAtCanon
            ? updatedAtCanon.toISOString()
            : new Date().toISOString(),
          meta: (canonical as any)?.meta ?? {},
        };
        await this.cache.set(cacheKey, res, 300);
        return res;
      }
    } catch (err) {
      this.logger.error(
        `Contract merge failed for user ${id} (canonVer=${(canonical as any)?.version}, userVer=${(personalized as any)?.version})`,
        (err as Error)?.stack ?? String(err),
      );
      // On error, gracefully degrade to canonical
    }

    // No personalized or merge errored: return canonical
    const createdAt = (canonical as any)?.createdAt as Date | undefined;
    const updatedAt = (canonical as any)?.updatedAt as Date | undefined;
    const filteredCanonJson = this.flutterFilter.filterForFlutter(
      ((canonical as any)?.json ?? {}) as Record<string, unknown>,
    );
    const res: ContractDTO = {
      id: (canonical as any)?._id?.toString?.() || '',
      userId: id,
      version: (canonical as any)?.version ?? '',
      json: filteredCanonJson,
      createdAt: createdAt ? createdAt.toISOString() : new Date().toISOString(),
      updatedAt: updatedAt ? updatedAt.toISOString() : new Date().toISOString(),
      meta: (canonical as any)?.meta ?? {},
    };
    await this.cache.set(cacheKey, res, 300);
    return res;
  }

  // Dashboard: POST /users/{id}/contract
  @Post(':id/contract')
  @ApiBody({ type: UpdateUserContractDto })
  @ApiResponse({
    status: 201,
    description: 'User contract updated/created.',
    type: ContractDto,
  })
  async updateUserContract(
    @Param('id') id: string,
    @Body() body: any,
    @Request() req: any,
  ): Promise<ContractDTO> {
    const { json, version, meta } = body;
    const doc = await this.contractService.create(
      json,
      version,
      meta,
      req?.user?.userId ?? process.env.PUBLIC_EVENTS_USER_ID ?? '000000000000000000000000',
      id,
    );
    const createdAt = (doc as any).createdAt as Date | undefined;
    const updatedAt = (doc as any).updatedAt as Date | undefined;
    const res: ContractDTO = {
      id: (doc as any)._id?.toString?.() || '',
      userId: id,
      version: (doc as any).version,
      json: (doc as any).json as Record<string, unknown>,
      createdAt: createdAt ? createdAt.toISOString() : new Date().toISOString(),
      updatedAt: updatedAt ? updatedAt.toISOString() : new Date().toISOString(),
      meta: (doc as any).meta ?? {},
    };
    // Invalidate cache for this user's contract if present
    await this.cache.del(`contracts:user:${id}`);
    return res;
  }

  // Dashboard: GET /users/{id}/tracking-events
  @Get(':id/tracking-events')
  @ApiResponse({
    status: 200,
    description: 'User tracking events.',
    type: TrackingEventDto,
    isArray: true,
  })
  async getUserTrackingEvents(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<TrackingEventDTO[]> {
    const list = await this.eventService.listByUser(
      req?.user?.userId ?? id,
      'ADMIN',
      id,
    );
    return list.map((e) => ({
      id: e._id.toString(),
      userId: e.userId.toString(),
      eventType: e.eventType,
      timestamp: e.timestamp.toISOString(),
      page: e.page,
      component: e.componentId,
      payload: e.data as Record<string, unknown>,
      sessionId: (e as any).sessionId?.toString?.(),
    }));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }
}
