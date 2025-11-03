import { Injectable, Optional, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types as MongooseTypes } from 'mongoose';
import { Event } from '../entities/event.entity';
import { CacheService } from '../../../common/services/cache.service';

@Injectable()
export class EventService {
  private readonly logger = new Logger(EventService.name);
  constructor(
    @InjectModel(Event.name) private readonly eventModel: Model<Event>,
    @Optional() private readonly cache?: CacheService,
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
    let overrideCount = 0;
    let fallbackCount = 0;
    const docs = events.map((e, idx) => {
      const perAlias = (e as any)?.userId;
      const isValidPerAlias = MongooseTypes.ObjectId.isValid(String(perAlias || ''));
      const effectiveUid = isValidPerAlias ? String(perAlias) : userId;
      if (isValidPerAlias && String(perAlias) !== String(userId)) {
        overrideCount++;
      } else {
        fallbackCount++;
      }
      return {
        userId: new MongooseTypes.ObjectId(effectiveUid),
        timestamp: new Date(e.timestamp),
        page: e.page,
        componentId: e.componentId,
        eventType: e.eventType,
        data: e.data || {},
        sessionId: e.sessionId
          ? new MongooseTypes.ObjectId(e.sessionId)
          : undefined,
      };
    });
    await this.eventModel.insertMany(docs);
    this.logger.log(
      `EventService.createBatch: inserted=${docs.length}, batchUid=${String(
        userId,
      )}, overrides=${overrideCount}, usedBatchOrInvalid=${fallbackCount}`,
    );
    return { inserted: docs.length };
  }

  async listByUser(requesterId: string, requesterRole: string, userId: string) {
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

  /**
   * Returns recent events for a user within a date range, limited for efficiency.
   * Maps `componentId` to `elementId` for downstream UX analysis prompts.
   */
  async getRecentEvents(
    userId: string,
    since: Date,
    limit: number = 100,
  ): Promise<
    Array<{
      eventType: string;
      elementId: string;
      timestamp: string;
      sessionId?: string;
      page?: string;
    }>
  > {
    const docs = await this.eventModel
      .find({
        userId: new MongooseTypes.ObjectId(userId),
        timestamp: { $gte: since },
      })
      .sort({ timestamp: -1 })
      .limit(limit)
      .select({
        eventType: 1,
        componentId: 1,
        timestamp: 1,
        sessionId: 1,
        page: 1,
        _id: 0,
      })
      .lean();

    return (docs as any[]).map((d) => ({
      eventType: String(d.eventType),
      elementId: String(d.componentId),
      timestamp: new Date(d.timestamp).toISOString(),
      sessionId: d.sessionId ? String(d.sessionId) : undefined,
      page: d.page ? String(d.page) : undefined,
    }));
  }

  async aggregateByPage(
    page: string,
    timeRange: '24h' | '7d' | '30d' | 'all' = 'all',
    eventType?: string,
  ) {
    const key = `events:aggregate:${page}:${timeRange}:${eventType || 'all'}`;
    const cached = this.cache ? await this.cache.get<any>(key) : undefined;
    if (cached) return cached;

    // Base match filter
    const match: any = { page };
    if (eventType) match.eventType = eventType;
    if (timeRange && timeRange !== 'all') {
      const now = Date.now();
      const ms =
        timeRange === '24h'
          ? 24 * 3600 * 1000
          : timeRange === '7d'
          ? 7 * 24 * 3600 * 1000
          : 30 * 24 * 3600 * 1000;
      match.timestamp = { $gte: new Date(now - ms) };
    }

    // Totals
    const totalEvents = await this.eventModel.countDocuments(match);

    // Event type distribution
    const typeAgg = await this.eventModel.aggregate([
      { $match: match },
      { $group: { _id: '$eventType', count: { $sum: 1 } } },
    ]);
    const eventTypeCounts = typeAgg.reduce<Record<string, number>>(
      (acc, row: any) => {
        acc[String(row._id)] = row.count;
        return acc;
      },
      {},
    );

    // Unique users
    const distinctUsers = await this.eventModel.distinct('userId', match);
    const uniqueUsers = Array.isArray(distinctUsers) ? distinctUsers.length : 0;

    // Average session duration (approx): span per session within page/time range
    const sessionDurAgg = await this.eventModel.aggregate([
      { $match: { ...match, sessionId: { $ne: null } } },
      {
        $group: {
          _id: '$sessionId',
          minTs: { $min: '$timestamp' },
          maxTs: { $max: '$timestamp' },
        },
      },
      {
        $project: {
          _id: 0,
          durationSec: {
            $divide: [{ $subtract: ['$maxTs', '$minTs'] }, 1000],
          },
        },
      },
      { $group: { _id: null, avg: { $avg: '$durationSec' } } },
    ]);
    const averageSessionDurationSec = sessionDurAgg?.[0]?.avg || 0;

    // Top components by interaction count
    const interactionMatch = {
      ...match,
      eventType: { $in: ['tap', 'input', 'navigate'] as any },
    };
    const topComponentsAgg = await this.eventModel.aggregate([
      { $match: interactionMatch },
      { $group: { _id: '$componentId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $project: { _id: 0, componentId: '$_id', count: 1 } },
    ]);

    // Error metrics
    const errorCount = await this.eventModel.countDocuments({
      ...match,
      eventType: 'error',
    });
    const errorRatePercent = totalEvents
      ? Math.round((errorCount / totalEvents) * 10000) / 100
      : 0;
    const topErrorMessagesAgg = await this.eventModel.aggregate([
      { $match: { ...match, eventType: 'error' } },
      { $group: { _id: '$data.message', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $project: { _id: 0, message: '$_id', count: 1 } },
    ]);

    // Rage-click detection (3+ taps within 1s windows per component)
    const tapEvents = await this.eventModel
      .find({ ...match, eventType: 'tap' })
      .sort({ componentId: 1, timestamp: 1 })
      .select({ componentId: 1, timestamp: 1 })
      .lean();
    const windowCounts: Record<string, number> = {};
    for (const e of tapEvents as any[]) {
      const ts = new Date(e.timestamp).getTime();
      const sec = Math.floor(ts / 1000);
      const key = `${String(e.componentId)}_${sec}`;
      windowCounts[key] = (windowCounts[key] || 0) + 1;
    }
    const rageClickComponentsMap: Record<string, number> = {};
    Object.entries(windowCounts).forEach(([key, count]) => {
      if (count >= 3) {
        const comp = key.split('_')[0];
        rageClickComponentsMap[comp] = (rageClickComponentsMap[comp] || 0) + 1;
      }
    });
    const rageClickComponents = Object.entries(rageClickComponentsMap)
      .map(([componentId, occurrences]) => ({ componentId, occurrences }))
      .sort((a, b) => b.occurrences - a.occurrences);

    const result = {
      page,
      timeframeStart:
        match.timestamp && match.timestamp.$gte
          ? (match.timestamp.$gte as Date).toISOString()
          : undefined,
      timeframeEnd: new Date().toISOString(),
      totalEvents,
      eventTypeCounts,
      uniqueUsers,
      averageSessionDurationSec,
      topComponents: topComponentsAgg,
      errorRatePercent,
      topErrorMessages: topErrorMessagesAgg,
      rageClickComponents,
    };

    if (this.cache) {
      await this.cache.set(key, result, 900);
    }
    return result;
  }
}
