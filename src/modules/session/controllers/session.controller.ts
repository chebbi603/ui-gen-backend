import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SessionService } from '../services/session.service';
import { CreateSessionDto } from '../dto/create-session.dto';
import { SessionDto } from '../dto/session.dto';
import { SessionWithEventsDto } from '../dto/session-with-events.dto';

@ApiTags('sessions')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard)
@Controller('sessions')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Post('start')
  @ApiBody({ type: CreateSessionDto })
  @ApiResponse({
    status: 201,
    description: 'Session started.',
    type: SessionDto,
  })
  async start(
    @Body() body: CreateSessionDto,
    @Request() req: any,
  ): Promise<SessionDto> {
    const doc = await this.sessionService.start(
      req.user.userId,
      body.contractVersion,
      body.deviceInfo,
      (body as any).platform,
    );
    return {
      id: doc._id.toString(),
      userId: doc.userId.toString(),
      startedAt: doc.startedAt.toISOString(),
      endedAt: doc.endedAt ? doc.endedAt.toISOString() : undefined,
      deviceInfo: doc.deviceInfo,
      contractVersion: doc.contractVersion,
      platform: (doc as any).platform,
    };
  }

  @Post(':id/end')
  @ApiResponse({ status: 200, description: 'Session ended.', type: SessionDto })
  async end(@Param('id') id: string, @Request() req: any): Promise<SessionDto> {
    const doc = await this.sessionService.end(
      req.user.userId,
      req.user.role,
      id,
    );
    return {
      id: doc._id.toString(),
      userId: doc.userId.toString(),
      startedAt: doc.startedAt.toISOString(),
      endedAt: doc.endedAt ? doc.endedAt.toISOString() : undefined,
      deviceInfo: doc.deviceInfo,
      contractVersion: doc.contractVersion,
      platform: (doc as any).platform,
    };
  }

  @Get('user/:userId')
  @ApiResponse({
    status: 200,
    description: 'List user sessions.',
    type: SessionDto,
    isArray: true,
  })
  async listUserSessions(
    @Param('userId') userId: string,
    @Request() req: any,
  ): Promise<SessionDto[]> {
    const list = await this.sessionService.listByUser(
      req.user.userId,
      req.user.role,
      userId,
    );
    return list.map((doc: any) => ({
      id: doc._id.toString(),
      userId: doc.userId.toString(),
      startedAt: doc.startedAt.toISOString(),
      endedAt: doc.endedAt ? doc.endedAt.toISOString() : undefined,
      deviceInfo: doc.deviceInfo,
      contractVersion: doc.contractVersion,
      platform: (doc as any).platform,
    }));
  }

  @Get(':id')
  @ApiResponse({
    status: 200,
    description: 'Session details with events.',
    type: SessionWithEventsDto,
  })
  async getSession(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<SessionWithEventsDto> {
    const { doc, events } = await this.sessionService.getWithEvents(
      req.user.userId,
      req.user.role,
      id,
    );
    return {
      id: doc._id.toString(),
      userId: doc.userId.toString(),
      startedAt: doc.startedAt.toISOString(),
      endedAt: doc.endedAt ? doc.endedAt.toISOString() : undefined,
      deviceInfo: doc.deviceInfo,
      contractVersion: doc.contractVersion,
      platform: (doc as any).platform,
      events: events.map((e: any) => ({
        id: e._id.toString(),
        userId: e.userId.toString(),
        eventType: e.eventType,
        timestamp: e.timestamp.toISOString(),
        page: e.page,
        component: e.componentId,
        payload: e.data as Record<string, unknown>,
        sessionId: (e as any).sessionId?.toString?.(),
      })),
    };
  }
}