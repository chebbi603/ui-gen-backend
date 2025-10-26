import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserContract, UserContractSchema } from './entities/user-contract.entity';
import { UserContractService } from './services/user-contract.service';
import { UserContractController } from './controllers/user-contract.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: UserContract.name, schema: UserContractSchema }])],
  providers: [UserContractService],
  controllers: [UserContractController],
  exports: [MongooseModule, UserContractService],
})
export class UserContractModule {}