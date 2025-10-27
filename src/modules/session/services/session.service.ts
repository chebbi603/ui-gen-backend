import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types as MongooseTypes } from 'mongoose';
import { Session } from '../entities/session.entity';
import { EventService } from '../../event/services/event.service';

@Injectable()
export class SessionService {
  constructor(
    @InjectModel(Session.name) private readonly sessionModel: Model<Session>,
    private readonly eventService: EventService,
  ) {}

  async start(userId: string, contractVersion: string, deviceInfo?: string) {
    const doc = await this.sessionModel.create({
      userId: new MongooseTypes.ObjectId(userId),
      startedAt: new Date(),
      deviceInfo,
      contractVersion,
    });
    return doc;
  }

  async end(requesterId: string, requesterRole: string, sessionId: string) {
    const doc = await this.sessionModel.findById(
      new MongooseTypes.ObjectId(sessionId),
    );
    if (!doc) throw new NotFoundException('Session not found');
    if (doc.userId.toString() !== requesterId && requesterRole !== 'ADMIN') {
      throw new ForbiddenException('Cannot end other user session');
    }
    doc.endedAt = new Date();
    await doc.save();
    return doc;
  }

  async listByUser(requesterId: string, requesterRole: string, userId: string) {
    if (requesterId !== userId && requesterRole !== 'ADMIN') {
      throw new ForbiddenException('Cannot list other user sessions');
    }
    return this.sessionModel
      .find({ userId: new MongooseTypes.ObjectId(userId) })
      .sort({ startedAt: -1 });
  }

  async getById(requesterId: string, requesterRole: string, sessionId: string) {
    const doc = await this.sessionModel.findById(
      new MongooseTypes.ObjectId(sessionId),
    );
    if (!doc) throw new NotFoundException('Session not found');
    if (doc.userId.toString() !== requesterId && requesterRole !== 'ADMIN') {
      throw new ForbiddenException('Cannot view other user session');
    }
    return doc;
  }

  async getWithEvents(
    requesterId: string,
    requesterRole: string,
    sessionId: string,
  ) {
    const doc = await this.getById(requesterId, requesterRole, sessionId);
    const events = await this.eventService.listByUser(
      doc.userId.toString(),
      'ADMIN',
      doc.userId.toString(),
    );
    // Filter events to sessionId if present
    const filtered = events.filter((e: any) => {
      const sid = (e as any).sessionId?.toString?.();
      return !sid || sid === sessionId; // include events without session or matching
    });
    return { doc, events: filtered };
  }
}