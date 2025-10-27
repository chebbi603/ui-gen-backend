import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Contract, ContractSchema } from './entities/contract.entity';
import { ContractService } from './services/contract.service';
import { ContractController } from './controllers/contract.controller';
import { ContractValidationService } from './services/contract-validation.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Contract.name, schema: ContractSchema },
    ]),
  ],
  providers: [ContractService, ContractValidationService],
  controllers: [ContractController],
  exports: [MongooseModule, ContractService, ContractValidationService],
})
export class ContractModule {}
