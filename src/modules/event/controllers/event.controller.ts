import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  Query,
} from '@nestjs/common';
import { ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EventService } from '../services/event.service';
import { InsertedCountDto } from '../dto/inserted-count.dto';
import {
  CreateEventsBatchDto,
  EventDto,
  AggregateQueryDto,
  AggregateResultDto,
} from '../dto/index';

@ApiTags('events')
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
    const uid = req?.user?.userId ?? process.env.PUBLIC_EVENTS_USER_ID ?? '000000000000000000000000';
    return this.eventService.createBatch(uid, body.events);
  }

  @Post('/tracking-event')
  @ApiBody({ type: EventDto })
  @ApiResponse({
    status: 201,
    description: 'Single tracking event stored.',
    type: InsertedCountDto,
  })
  async createSingleEvent(@Body() body: EventDto, @Request() req: any) {
    const uid = req?.user?.userId ?? process.env.PUBLIC_EVENTS_USER_ID ?? '000000000000000000000000';
    return this.eventService.createBatch(uid, [body]);
  }

  @Get('aggregate')
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
