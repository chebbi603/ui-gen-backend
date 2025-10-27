import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EventService } from '../services/event.service';
import { CreateEventsBatchDto, EventDto } from '../dto/create-events.dto';
import { InsertedCountDto } from '../dto/inserted-count.dto';
import { TrackingEventDto } from '../dto/tracking-event.dto';

@ApiTags('events')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Post()
  @ApiBody({ type: CreateEventsBatchDto })
  @ApiResponse({
    status: 201,
    description: 'Batched events stored.',
    type: InsertedCountDto,
  })
  async createEvents(@Body() body: CreateEventsBatchDto, @Request() req: any) {
    return this.eventService.createBatch(req.user.userId, body.events);
  }

  @Post('/tracking-event')
  @ApiBody({ type: EventDto })
  @ApiResponse({
    status: 201,
    description: 'Single tracking event stored.',
    type: InsertedCountDto,
  })
  async createSingleEvent(@Body() body: EventDto, @Request() req: any) {
    return this.eventService.createBatch(req.user.userId, [body]);
  }

  @Get('user/:userId')
  @ApiResponse({
    status: 200,
    description: 'List events for a specific user.',
    type: TrackingEventDto,
    isArray: true,
  })
  async listUserEvents(@Param('userId') userId: string, @Request() req: any) {
    return this.eventService.listByUser(req.user.userId, req.user.role, userId);
  }
}
