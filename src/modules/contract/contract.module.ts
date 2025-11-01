import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Contract, ContractSchema } from './entities/contract.entity';
import { ContractService } from './services/contract.service';
import { ContractController } from './controllers/contract.controller';
import { ContractValidationService } from './services/contract-validation.service';
import { ContractPublicController } from './controllers/contract-public.controller';
import { CacheService } from '../../common/services/cache.service';
import { ConfigModule } from '@nestjs/config';
import { ContractMergeService } from './services/contract-merge.service';
import { FlutterContractFilterService } from './services/flutter-contract-filter.service';
import { ContractBuilderService } from './services/contract-builder.service';
import { AdminContractController } from './controllers/admin-contract.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Contract.name, schema: ContractSchema },
    ]),
    ConfigModule,
  ],
  providers: [
    ContractService,
    ContractValidationService,
    ContractMergeService,
    CacheService,
    FlutterContractFilterService,
    ContractBuilderService,
  ],
  // Register public controller first so static routes like 'canonical'
  // are matched before dynamic ':id' routes in ContractController.
  controllers: [ContractPublicController, ContractController, AdminContractController],
  exports: [
    MongooseModule,
    ContractService,
    ContractValidationService,
    ContractMergeService,
    FlutterContractFilterService,
    ContractBuilderService,
  ],
})
export class ContractModule {}
