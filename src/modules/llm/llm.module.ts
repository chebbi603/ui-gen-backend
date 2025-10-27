import { Module } from '@nestjs/common';
import { LlmService } from './services/llm.service';
import { LlmController } from './controllers/llm.controller';
import { ContractModule } from '../contract/contract.module';
import { EventModule } from '../event/event.module';

@Module({
  imports: [ContractModule, EventModule],
  providers: [LlmService],
  controllers: [LlmController],
  exports: [LlmService],
})
export class LlmModule {}
