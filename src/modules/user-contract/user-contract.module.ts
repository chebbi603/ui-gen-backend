import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserContract, UserContractSchema } from './entities/user-contract.entity';

@Module({
  imports: [MongooseModule.forFeature([{ name: UserContract.name, schema: UserContractSchema }])],
  exports: [MongooseModule],
})
export class UserContractModule {}