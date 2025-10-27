import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  SetMetadata,
  Request,
  Post,
} from '@nestjs/common';
import { UserService } from '../services/user.service';
import { UpdateUserDto } from '../dto/update-user.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../../auth/guards/role-auth.guard';
import { ApiBearerAuth, ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserDto } from '../dto/user.dto';
import { ContractService } from '../../contract/services/contract.service';
import { EventService } from '../../event/services/event.service';
import { UserDTO, ContractDTO, TrackingEventDTO } from '../../../common/dto';
import { ContractDto } from '../../contract/dto/contract.dto';
import { UpdateUserContractDto } from '../dto/update-user-contract.dto';
import { TrackingEventDto } from '../../event/dto/tracking-event.dto';
import { UserSummaryDto } from '../dto/user-summary.dto';

@ApiTags('users')
@ApiBearerAuth('accessToken')
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly contractService: ContractService,
    private readonly eventService: EventService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiResponse({
    status: 200,
    description: 'Current user info.',
    type: UserDto,
  })
  me(@Request() req: any) {
    return this.userService.findOne(req.user.userId);
  }

  @SetMetadata('roles', ['ADMIN'])
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Get()
  @ApiResponse({
    status: 200,
    description: 'List all users summary.',
    type: UserSummaryDto,
    isArray: true,
  })
  async findAll(): Promise<UserDTO[]> {
    const q = await (this.userService.findAll() as any).exec();
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
        lastActive: (lastEvent ?? u.updatedAt)?.toISOString(),
        contractVersion: latestContract?.version ?? '',
      });
    }
    return res;
  }

  @SetMetadata('roles', ['ADMIN'])
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  // Dashboard & Flutter: GET /users/{id}/contract
  @UseGuards(JwtAuthGuard)
  @Get(':id/contract')
  @ApiResponse({
    status: 200,
    description: 'Latest user contract.',
    type: ContractDto,
  })
  async getUserContract(@Param('id') id: string): Promise<ContractDTO | null> {
    const doc = await this.contractService.findLatestByUser(id);
    if (!doc) return null;
    const createdAt = (doc as any).createdAt as Date | undefined;
    const updatedAt = (doc as any).updatedAt as Date | undefined;
    return {
      userId: doc.userId?.toString() || id,
      version: doc.version,
      json: doc.json as Record<string, unknown>,
      createdAt: createdAt ? createdAt.toISOString() : new Date().toISOString(),
      updatedAt: updatedAt ? updatedAt.toISOString() : new Date().toISOString(),
    };
  }

  // Dashboard: POST /users/{id}/contract
  @SetMetadata('roles', ['ADMIN'])
  @UseGuards(JwtAuthGuard, RoleGuard)
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
      req.user.userId,
      id,
    );
    const createdAt = (doc as any).createdAt as Date | undefined;
    const updatedAt = (doc as any).updatedAt as Date | undefined;
    return {
      userId: id,
      version: doc.version,
      json: doc.json as Record<string, unknown>,
      createdAt: createdAt ? createdAt.toISOString() : new Date().toISOString(),
      updatedAt: updatedAt ? updatedAt.toISOString() : new Date().toISOString(),
    };
  }

  // Dashboard: GET /users/{id}/tracking-events
  @UseGuards(JwtAuthGuard)
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
      req.user.userId,
      req.user.role,
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

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(id, updateUserDto);
  }

  @SetMetadata('roles', ['ADMIN'])
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }
}
