import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Contract, ContractSchema } from './entities/contract.entity';
import { ContractService } from './services/contract.service';
import { ContractController } from './controllers/contract.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: Contract.name, schema: ContractSchema }])],
  providers: [ContractService],
  controllers: [ContractController],
  exports: [MongooseModule, ContractService],
})
export class ContractModule {}