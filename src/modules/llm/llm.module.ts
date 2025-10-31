import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LlmService } from './services/llm.service';
import { LlmController } from './controllers/llm.controller';
import { LlmPublicController } from './controllers/llm.public.controller';
import { ContractModule } from '../contract/contract.module';
import { EventModule } from '../event/event.module';
import { GeminiClient } from './clients/gemini.client';
import { SessionModule } from '../session/session.module';
import { GeminiService } from './services/gemini.service';

@Module({
  imports: [ConfigModule, ContractModule, EventModule, SessionModule],
  providers: [LlmService, GeminiClient, GeminiService],
  controllers: [LlmController, LlmPublicController],
  exports: [LlmService, GeminiClient, GeminiService],
})
export class LlmModule {}
