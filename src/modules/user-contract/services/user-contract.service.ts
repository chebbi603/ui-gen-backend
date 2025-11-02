import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types as MongooseTypes } from 'mongoose';
import { UserContract } from '../entities/user-contract.entity';
import { validateContractJson } from '../../../common/validators/contract.validator';

@Injectable()
export class UserContractService {
  constructor(
    @InjectModel(UserContract.name)
    private readonly userContractModel: Model<UserContract>,
  ) {}

  async getUserContract(userId: string) {
    const doc = await this.userContractModel
      .findOne({ userId: new MongooseTypes.ObjectId(userId) })
      .sort({ updatedAt: -1 });
    return doc;
  }

  async upsertUserContract(
    userId: string,
    contractId: string | undefined,
    json: any,
    requesterId: string,
    requesterRole: string,
  ) {
    const { valid, errors } = validateContractJson(json);
    if (!valid)
      throw new BadRequestException({
        message: 'Invalid contract json',
        errors,
      });
    const filter: any = { userId: new MongooseTypes.ObjectId(userId) };
    if (contractId) filter.contractId = new MongooseTypes.ObjectId(contractId);
    const doc = await this.userContractModel.findOneAndUpdate(
      filter,
      { $set: { json } },
      { upsert: true, new: true },
    );
    return doc;
  }
}
