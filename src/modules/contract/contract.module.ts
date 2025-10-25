import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Contract, ContractSchema } from './entities/contract.entity';

@Module({
  imports: [MongooseModule.forFeature([{ name: Contract.name, schema: ContractSchema }])],
  exports: [MongooseModule],
})
export class ContractModule {}