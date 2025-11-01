import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
  Query,
  SetMetadata,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EventService } from '../services/event.service';
import { InsertedCountDto } from '../dto/inserted-count.dto';
import { RoleGuard } from '../../auth/guards/role-auth.guard';
import {
  CreateEventsBatchDto,
  EventDto,
  AggregateQueryDto,
  AggregateResultDto,
} from '../dto/index';

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

  @Get('aggregate')
  @SetMetadata('roles', ['ADMIN'])
  @UseGuards(JwtAuthGuard, RoleGuard)
  @ApiResponse({
    status: 200,
    description: 'Aggregate events statistics.',
    type: AggregateResultDto,
  })
  async getAggregateEvents(@Query() query: AggregateQueryDto) {
    const { page, timeRange = 'all', eventType } = query;
    return this.eventService.aggregateByPage(page, timeRange as any, eventType);
  }
}
