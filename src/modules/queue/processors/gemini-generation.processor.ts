import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { GeminiGenerationJobData } from '../queue.constants';
import { LlmService } from '../../llm/services/llm.service';
import { ContractService } from '../../contract/services/contract.service';
import { UserContractService } from '../../user-contract/services/user-contract.service';
import { ContractValidationService } from '../../contract/services/contract-validation.service';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../../common/services/cache.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types as MongooseTypes } from 'mongoose';
import { LlmJob } from '../../llm/entities/llm-job.entity';

@Injectable()
export class GeminiGenerationProcessor {
  private readonly logger = new Logger(GeminiGenerationProcessor.name);

  constructor(
    private readonly llmService: LlmService,
    private readonly contractService: ContractService,
    private readonly userContractService: UserContractService,
    private readonly validationService: ContractValidationService,
    private readonly config: ConfigService,
    private readonly cache: CacheService,
    @InjectModel(LlmJob.name) private readonly llmJobModel: Model<LlmJob>,
  ) {}

  async process(job: Job<GeminiGenerationJobData>): Promise<{ contractId?: string; version?: string; explanation?: string }> {
    const { userId, baseContract, version } = job.data;
    try {
      const startedAt = new Date();
      const llmJob = new this.llmJobModel({
        jobId: String(job.id),
        userId: new MongooseTypes.ObjectId(userId),
        status: 'processing',
        progress: 0,
        startedAt,
        model: this.config.get<string>('llm.gemini.model') || 'gemini-2.5-pro',
      });
      await llmJob.save();
      await job.updateProgress(25);

      const { json, version: nextVersion, llmDebug } =
        await this.llmService.generateOptimizedContract({
          userId,
          baseContract,
          version,
        });
      await job.updateProgress(50);
      // Persist raw prompts and response for auditing
      if (llmDebug) {
        await this.llmJobModel.updateOne(
          { jobId: String(job.id) },
          {
            $set: {
              requestPayload: llmDebug.request,
              responseText: llmDebug.rawResponse,
            },
          },
        );
      }
      // Pre-persistence validation of generated contract JSON
      const validation = this.validationService.validate(json as Record<string, any>);
      if (!validation.isValid) {
        const msg =
          'Validation error: ' +
          validation.errors.map((e) => `${e.path}: ${e.message}`).join('; ');
        throw new Error(msg);
      }
      const contract = await this.contractService.create(
        json,
        nextVersion,
        { optimizedBy: 'gemini', optimizedByModel: this.config.get<string>('llm.gemini.model') },
        userId,
        userId,
      );
      await job.updateProgress(75);
      // Upsert user contract link
      await this.userContractService.upsertUserContract(
        userId,
        (contract as any)._id?.toString?.(),
        contract.json,
        userId,
        'ADMIN',
      );

      // Invalidate merged-contract cache for this user so GET /users/:id/contract reflects new personalized contract
      try {
        await this.cache.del(`contracts:user:${userId}`);
      } catch {}

      const completedAt = new Date();
      const durationMs = completedAt.getTime() - startedAt.getTime();
      await this.llmJobModel.updateOne(
        { jobId: String(job.id) },
        {
          $set: {
            status: 'completed',
            progress: 100,
            completedAt,
            durationMs,
            reasoning: (contract as any).meta?.optimizationExplanation,
            analyzedMetrics: (contract as any).analytics || undefined,
            contractId: (contract as any)._id,
          },
        },
      );
      await job.updateProgress(100);
      this.logger.log(`Processed gemini-generation job for userId=${userId}.`);
      return {
        contractId: (contract as any)._id?.toString?.(),
        version: contract.version,
        explanation: (contract as any).meta?.optimizationExplanation,
      };
    } catch (err: any) {
      const msg = err?.message || String(err);
      this.logger.error(`Gemini generation job failed for userId=${userId}: ${msg}`);
      const failedAt = new Date();
      await this.llmJobModel.updateOne(
        { jobId: String(job.id) },
        {
          $set: {
            status: 'failed',
            errorMessage: msg,
            progress: 0,
            completedAt: failedAt,
          },
        },
      );
      // Differentiate retryable vs permanent failures
      const lower = msg.toLowerCase();
      const retryable = lower.includes('rate limit') || lower.includes('429') || lower.includes('timeout') || lower.includes('network');
      if (!retryable) {
        await job.discard();
      }
      throw err; // Allow BullMQ to handle retries based on discard
    }
  }
}