import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types as MongooseTypes } from 'mongoose';
import { Event } from '../entities/event.entity';

@Injectable()
export class EventService {
  constructor(@InjectModel(Event.name) private readonly eventModel: Model<Event>) {}

  async createBatch(userId: string, events: Array<{ timestamp: string; componentId: string; eventType: string; data?: any }>) {
    const docs = events.map((e) => ({
      userId: new MongooseTypes.ObjectId(userId),
      timestamp: new Date(e.timestamp),
      componentId: e.componentId,
      eventType: e.eventType,
      data: e.data || {},
    }));
    await this.eventModel.insertMany(docs);
    return { inserted: docs.length };
  }

  async listByUser(requesterId: string, requesterRole: string, userId: string) {
    if (requesterId !== userId && requesterRole !== 'ADMIN') {
      throw new ForbiddenException('Cannot list other user events');
    }
    return this.eventModel.find({ userId: new MongooseTypes.ObjectId(userId) }).sort({ timestamp: -1 });
  }
}