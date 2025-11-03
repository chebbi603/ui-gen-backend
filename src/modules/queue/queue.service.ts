import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, JobsOptions, QueueEvents, Job } from 'bullmq';
import IORedis, { Redis } from 'ioredis';
import {
  GEMINI_GENERATION_QUEUE,
  GeminiGenerationJobData,
  ANALYZE_EVENTS_QUEUE,
  AnalyzeEventsJobData,
} from './queue.constants';
import { GeminiGenerationProcessor } from './processors/gemini-generation.processor';
import { AnalyzeEventsProcessor } from './processors/analyze-events.processor';

type RedisConnectionOptions = {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
};

@Injectable()
export class QueueService implements OnModuleInit {
  private readonly logger = new Logger(QueueService.name);
  private connection?: Redis;
  private queue?: Queue<GeminiGenerationJobData, any>;
  private worker?: Worker<GeminiGenerationJobData, any>;
  private events?: QueueEvents;

  private queueAnalyze?: Queue<AnalyzeEventsJobData, any>;
  private workerAnalyze?: Worker<AnalyzeEventsJobData, any>;
  private eventsAnalyze?: QueueEvents;

  constructor(
    private readonly config: ConfigService,
    private readonly processor: GeminiGenerationProcessor,
    private readonly analyzeProcessor: AnalyzeEventsProcessor,
  ) {}

  async onModuleInit() {
    try {
      const redisUrl = this.config.get<string>('redis.url');
      const opts: RedisConnectionOptions = {
        host: this.config.get<string>('redis.host'),
        port: this.config.get<number>('redis.port'),
        password: this.config.get<string>('redis.password'),
        db: this.config.get<number>('redis.db'),
      };
      const commonOpts = {
        // Avoid noisy auto-retries in dev when Redis isn't running
        lazyConnect: true,
        // BullMQ requires this to be null to avoid ioredis auto-retries
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        retryStrategy: () => null,
        reconnectOnError: () => false,
      } as any;
      this.connection = redisUrl
        ? new IORedis(redisUrl, commonOpts)
        : new IORedis({ ...(opts as any), ...commonOpts });
      // Swallow error events to prevent "Unhandled error event" spam
      this.connection.on('error', (err) => {
        this.logger.warn(`Redis connection error: ${err?.message || err}`);
      });
      // Try to connect once; if it fails, skip queue init
      await (this.connection as any).connect?.();

      // Default job options from config
      const attempts = this.config.get<number>('queue.gemini.attempts') ?? 3;
      const backoffMs = this.config.get<number>('queue.gemini.backoffMs') ?? 5000;
      const timeoutMs = this.config.get<number>('queue.gemini.timeoutMs') ?? 60000;
      const defaultJobOptions: JobsOptions = {
        attempts,
        backoff: { type: 'exponential', delay: backoffMs },
        // Note: some BullMQ versions do not support 'timeout' in JobsOptions typings; omit here.
      };

      this.queue = new Queue<GeminiGenerationJobData>(GEMINI_GENERATION_QUEUE, {
        connection: this.connection,
        defaultJobOptions,
      });

      // Worker to process jobs using the processor
      this.worker = new Worker<GeminiGenerationJobData>(
        GEMINI_GENERATION_QUEUE,
        async (job) => this.processor.process(job),
        { connection: this.connection },
      );

      // Queue events for visibility
      this.events = new QueueEvents(GEMINI_GENERATION_QUEUE, {
        connection: this.connection,
      });

      // Analyze-events queue
      this.queueAnalyze = new Queue<AnalyzeEventsJobData>(ANALYZE_EVENTS_QUEUE, {
        connection: this.connection,
        defaultJobOptions,
      });
      this.workerAnalyze = new Worker<AnalyzeEventsJobData>(
        ANALYZE_EVENTS_QUEUE,
        async (job) => this.analyzeProcessor.process(job),
        { connection: this.connection },
      );
      this.eventsAnalyze = new QueueEvents(ANALYZE_EVENTS_QUEUE, {
        connection: this.connection,
      });

      this.bindEventListeners();
      this.logger.log(`BullMQ queue '${GEMINI_GENERATION_QUEUE}' initialized.`);
      this.logger.log(`BullMQ queue '${ANALYZE_EVENTS_QUEUE}' initialized.`);

      // Cleanup old jobs
      const completedMs = this.config.get<number>('queue.cleanup.completedMs') ?? 604800000;
      const failedMs = this.config.get<number>('queue.cleanup.failedMs') ?? 604800000;
      await this.queue.clean(completedMs, 1000, 'completed');
      await this.queue.clean(failedMs, 1000, 'failed');
      await this.queueAnalyze.clean(completedMs, 1000, 'completed');
      await this.queueAnalyze.clean(failedMs, 1000, 'failed');
      this.logger.log('BullMQ queue cleanup executed for completed/failed jobs on both queues.');

      // Optional: add a test job on startup
      const addTest = this.config.get<boolean>('queue.addTestJob') ?? false;
      if (addTest) {
        await this.addGeminiGenerationJob({ userId: 'demo', baseContract: {}, priority: 1 });
        this.logger.warn('Added a demo gemini-generation job on startup (QUEUE_ADD_TEST_JOB=true).');
      }
    } catch (err: any) {
      this.logger.warn(`Queue initialization skipped due to error: ${err?.message || err}`);
    }
  }

  async addGeminiGenerationJob(
    data: GeminiGenerationJobData,
    options?: JobsOptions,
  ): Promise<string> {
    if (!this.queue) {
      this.logger.warn('Queue not initialized; cannot add gemini-generation job.');
      throw new Error('Queue not initialized');
    }
    const jobOptions: JobsOptions = {
      ...(options || {}),
      priority: options?.priority ?? data.priority,
    };
    const job = await this.queue.add('generate', data, jobOptions);
    this.logger.log(`Enqueued gemini-generation job id=${job.id} for userId=${data.userId}`);
    return String(job.id);
  }

  async addAnalyzeEventsJob(
    data: AnalyzeEventsJobData,
    options?: JobsOptions,
  ): Promise<string> {
    if (!this.queueAnalyze) {
      this.logger.warn('Queue not initialized; cannot add analyze-events job.');
      throw new Error('Queue not initialized');
    }
    const jobOptions: JobsOptions = {
      ...(options || {}),
      priority: options?.priority ?? data.priority,
    };
    const job = await this.queueAnalyze.add('analyze', data, jobOptions);
    this.logger.log(`Enqueued analyze-events job id=${job.id} for userId=${data.userId}`);
    return String(job.id);
  }

  async getGeminiJobStatus(jobId: string): Promise<{
    id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'unknown';
    progress: number;
    result?: any;
    error?: string | null;
    timestamps: { createdAt?: string; startedAt?: string; completedAt?: string };
  } | null> {
    if (!this.queue) return null;
    const job: Job | null = await this.queue.getJob(jobId);
    if (!job) return null;
    const state = await job.getState();
    const statusMap: Record<string, 'pending' | 'processing' | 'completed' | 'failed' | 'unknown'> = {
      waiting: 'pending',
      delayed: 'pending',
      paused: 'pending',
      active: 'processing',
      completed: 'completed',
      failed: 'failed',
      stalled: 'processing',
    };
    const status = statusMap[state] || 'unknown';
    const createdAt = job.timestamp ? new Date(job.timestamp).toISOString() : undefined;
    const startedAt = (job as any).processedOn ? new Date((job as any).processedOn).toISOString() : undefined;
    const completedAt = (job as any).finishedOn ? new Date((job as any).finishedOn).toISOString() : undefined;
    const error = job.failedReason || null;
    return {
      id: String(job.id),
      status,
      progress: (job.progress as number) || 0,
      result: job.returnvalue,
      error,
      timestamps: { createdAt, startedAt, completedAt },
    };
  }

  async getAnalyzeJobStatus(jobId: string): Promise<{
    id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'unknown';
    progress: number;
    result?: any;
    error?: string | null;
    timestamps: { createdAt?: string; startedAt?: string; completedAt?: string };
  } | null> {
    if (!this.queueAnalyze) return null;
    const job: Job | null = await this.queueAnalyze.getJob(jobId);
    if (!job) return null;
    const state = await job.getState();
    const statusMap: Record<string, 'pending' | 'processing' | 'completed' | 'failed' | 'unknown'> = {
      waiting: 'pending',
      delayed: 'pending',
      paused: 'pending',
      active: 'processing',
      completed: 'completed',
      failed: 'failed',
      stalled: 'processing',
    };
    const status = statusMap[state] || 'unknown';
    const createdAt = job.timestamp ? new Date(job.timestamp).toISOString() : undefined;
    const startedAt = (job as any).processedOn ? new Date((job as any).processedOn).toISOString() : undefined;
    const completedAt = (job as any).finishedOn ? new Date((job as any).finishedOn).toISOString() : undefined;
    const error = job.failedReason || null;
    return {
      id: String(job.id),
      status,
      progress: (job.progress as number) || 0,
      result: job.returnvalue,
      error,
      timestamps: { createdAt, startedAt, completedAt },
    };
  }

  private bindEventListeners() {
    if (!this.worker || !this.events || !this.workerAnalyze || !this.eventsAnalyze) return;

    this.worker.on('active', (job) => {
      this.logger.log(`Job ${job.id} is active (name=${job.name}).`);
    });
    this.worker.on('completed', (job, result) => {
      this.logger.log(`Job ${job.id} completed.`);
    });
    this.worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} failed: ${err?.message || err}`);
    });
    this.worker.on('stalled', (jobId) => {
      this.logger.warn(`Job ${jobId} stalled.`);
    });
    this.worker.on('error', (err) => {
      this.logger.error(`Worker error: ${err?.message || err}`);
    });

    this.events.on('waiting', ({ jobId }) => {
      this.logger.log(`Job ${jobId} is waiting.`);
    });
    this.events.on('added', ({ jobId }) => {
      this.logger.log(`Job ${jobId} was added to the queue.`);
    });

    // Analyze-events listeners
    this.workerAnalyze.on('active', (job) => {
      this.logger.log(`Analyze job ${job.id} is active (name=${job.name}).`);
    });
    this.workerAnalyze.on('completed', (job, result) => {
      this.logger.log(`Analyze job ${job.id} completed.`);
    });
    this.workerAnalyze.on('failed', (job, err) => {
      this.logger.error(`Analyze job ${job?.id} failed: ${err?.message || err}`);
    });
    this.workerAnalyze.on('stalled', (jobId) => {
      this.logger.warn(`Analyze job ${jobId} stalled.`);
    });
    this.workerAnalyze.on('error', (err) => {
      this.logger.error(`Analyze worker error: ${err?.message || err}`);
    });

    this.eventsAnalyze.on('waiting', ({ jobId }) => {
      this.logger.log(`Analyze job ${jobId} is waiting.`);
    });
    this.eventsAnalyze.on('added', ({ jobId }) => {
      this.logger.log(`Analyze job ${jobId} was added to the queue.`);
    });
  }
}