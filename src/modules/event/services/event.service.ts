import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types as MongooseTypes } from 'mongoose';
import { Event } from '../entities/event.entity';

@Injectable()
export class EventService {
  constructor(
    @InjectModel(Event.name) private readonly eventModel: Model<Event>,
  ) {}

  async createBatch(
    userId: string,
    events: Array<{
      timestamp: string;
      componentId: string;
      eventType: string;
      data?: any;
      page?: string;
      sessionId?: string;
    }>,
  ) {
    const docs = events.map((e) => ({
      userId: new MongooseTypes.ObjectId(userId),
      timestamp: new Date(e.timestamp),
      page: e.page,
      componentId: e.componentId,
      eventType: e.eventType,
      data: e.data || {},
      sessionId: e.sessionId
        ? new MongooseTypes.ObjectId(e.sessionId)
        : undefined,
    }));
    await this.eventModel.insertMany(docs);
    return { inserted: docs.length };
  }

  async listByUser(requesterId: string, requesterRole: string, userId: string) {
    if (requesterId !== userId && requesterRole !== 'ADMIN') {
      throw new ForbiddenException('Cannot list other user events');
    }
    return this.eventModel
      .find({ userId: new MongooseTypes.ObjectId(userId) })
      .sort({ timestamp: -1 });
  }

  async getLastForUser(userId: string): Promise<Date | null> {
    const doc = await this.eventModel
      .findOne({ userId: new MongooseTypes.ObjectId(userId) })
      .sort({ timestamp: -1 })
      .select({ timestamp: 1 });
    return doc?.timestamp ?? null;
  }
}
