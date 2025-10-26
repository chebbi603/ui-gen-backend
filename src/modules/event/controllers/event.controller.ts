import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EventService } from '../services/event.service';
import { CreateEventsBatchDto } from '../dto/create-events.dto';

@ApiTags('events')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Post()
  @ApiBody({ type: CreateEventsBatchDto })
  @ApiResponse({ status: 201, description: 'Batched events stored.' })
  async createEvents(@Body() body: CreateEventsBatchDto, @Request() req: any) {
    return this.eventService.createBatch(req.user.userId, body.events);
  }

  @Get('user/:userId')
  @ApiResponse({ status: 200, description: 'List events for a specific user.' })
  async listUserEvents(@Param('userId') userId: string, @Request() req: any) {
    return this.eventService.listByUser(req.user.userId, req.user.role, userId);
  }
}