import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AnalyzeEventsJobData } from '../queue.constants';
import { GeminiService } from '../../llm/services/gemini.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types as MongooseTypes } from 'mongoose';
import { LlmJob } from '../../llm/entities/llm-job.entity';

@Injectable()
export class AnalyzeEventsProcessor {
  private readonly logger = new Logger(AnalyzeEventsProcessor.name);

  constructor(
    private readonly geminiService: GeminiService,
    @InjectModel(LlmJob.name) private readonly llmJobModel: Model<LlmJob>,
  ) {}

  async process(
    job: Job<AnalyzeEventsJobData>,
  ): Promise<{
    painPoints: Array<{ title: string; description: string; elementId?: string; page?: string; severity?: string }>;
    improvements: Array<{ title: string; description: string; elementId?: string; page?: string; priority?: string }>;
    eventCount: number;
    timestamp: string;
    message?: string;
  }> {
    const startedAt = Date.now();
    const { userId, since, limit } = job.data;
    const uid = String(userId);
    try {
      await this.llmJobModel.updateOne(
        { jobId: job.id },
        {
          jobId: job.id,
          userId: new MongooseTypes.ObjectId(uid),
          status: 'processing',
          startedAt: new Date(),
          progress: 10,
        },
        { upsert: true },
      );

      const result = await this.geminiService.analyzeEventsForUser(uid, {
        since: typeof since === 'string' ? new Date(since) : since,
        limit,
      });

      const durationMs = Date.now() - startedAt;
      await this.llmJobModel.updateOne(
        { jobId: job.id },
        {
          status: 'completed',
          completedAt: new Date(),
          durationMs,
          progress: 100,
        },
      );

      return result;
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      await this.llmJobModel.updateOne(
        { jobId: job.id },
        {
          status: 'failed',
          completedAt: new Date(),
          durationMs,
          progress: 100,
          errorMessage: error?.message || 'Unknown error',
        },
        { upsert: true },
      );
      this.logger.error(`Analyze events job ${job.id} failed: ${error?.message}`);
      throw error;
    }
  }
}