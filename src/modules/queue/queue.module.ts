import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QueueService } from './queue.service';
import { LlmModule } from '../llm/llm.module';
import { GeminiGenerationProcessor } from './processors/gemini-generation.processor';
import { AnalyzeEventsProcessor } from './processors/analyze-events.processor';
import { ContractModule } from '../contract/contract.module';
import { UserContractModule } from '../user-contract/user-contract.module';
import { MongooseModule } from '@nestjs/mongoose';
import { LlmJob, LlmJobSchema } from '../llm/entities/llm-job.entity';
import { GeminiController } from './controllers/gemini.controller';
import { UserModule } from '../user/user.module';
import { EventModule } from '../event/event.module';

@Module({
  imports: [
    ConfigModule,
    LlmModule,
    ContractModule,
    UserModule,
    EventModule,
    UserContractModule,
    MongooseModule.forFeature([{ name: LlmJob.name, schema: LlmJobSchema }]),
  ],
  controllers: [GeminiController],
  providers: [QueueService, GeminiGenerationProcessor, AnalyzeEventsProcessor],
  exports: [QueueService],
})
export class QueueModule {}