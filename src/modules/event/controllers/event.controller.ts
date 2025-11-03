import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  Query,
  Logger,
} from '@nestjs/common';
import { Types as MongooseTypes } from 'mongoose';
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
  private readonly logger = new Logger(EventController.name);
  constructor(private readonly eventService: EventService) {}

  @Post()
  @ApiBody({ type: CreateEventsBatchDto })
  @ApiResponse({
    status: 201,
    description: 'Batched events stored.',
    type: InsertedCountDto,
  })
  async createEvents(@Body() body: CreateEventsBatchDto, @Request() req: any) {
    const aliasTop = (body as any)?.userId;
    const aliasEvent =
      Array.isArray(body?.events) && body.events.length > 0
        ? (body.events[0] as any)?.userId
        : undefined;
    const candidate =
      aliasTop ??
      aliasEvent ??
      req?.user?.userId ??
      process.env.PUBLIC_EVENTS_USER_ID ??
      '000000000000000000000000';
    const uid = MongooseTypes.ObjectId.isValid(candidate)
      ? candidate
      : process.env.PUBLIC_EVENTS_USER_ID ?? '000000000000000000000000';
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
    const aliasUid = (body as any)?.userId;
    const candidate =
      aliasUid ??
      req?.user?.userId ??
      process.env.PUBLIC_EVENTS_USER_ID ??
      '000000000000000000000000';
    const uid = MongooseTypes.ObjectId.isValid(candidate)
      ? candidate
      : process.env.PUBLIC_EVENTS_USER_ID ?? '000000000000000000000000';
    this.logger.log(
      `POST /events/tracking-event: eventType=${String(
        (body as any)?.eventType || 'unknown',
      )}, componentId=${String(
        (body as any)?.componentId || 'null',
      )}, alias=${String(aliasUid || 'null')}, jwtUser=${String(
        req?.user?.userId || 'null',
      )}, candidate=${String(candidate)}, resolvedUid=${String(uid)}`,
    );
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
