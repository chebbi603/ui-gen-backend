import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Contract, ContractSchema } from './entities/contract.entity';
import { ContractService } from './services/contract.service';
import { ContractController } from './controllers/contract.controller';
import { ContractValidationService } from './services/contract-validation.service';
import { ContractPublicController } from './controllers/contract-public.controller';
import { CacheService } from '../../common/services/cache.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Contract.name, schema: ContractSchema },
    ]),
    ConfigModule,
  ],
  providers: [ContractService, ContractValidationService, CacheService],
  controllers: [ContractController, ContractPublicController],
  exports: [MongooseModule, ContractService, ContractValidationService],
})
export class ContractModule {}
