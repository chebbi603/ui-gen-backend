import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types as MongooseTypes } from 'mongoose';
import { Contract } from '../entities/contract.entity';
import { validateContractJson } from '../../../common/validators/contract.validator';

@Injectable()
export class ContractService {
  constructor(
    @InjectModel(Contract.name) private readonly contractModel: Model<Contract>,
  ) {}

  async create(
    json: any,
    version: string,
    meta: any,
    createdBy: string,
    userId?: string,
  ) {
    const { valid, errors } = validateContractJson(json);
    if (!valid) {
      throw new BadRequestException({
        message: 'Invalid contract json',
        errors,
      });
    }
    if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
      throw new BadRequestException('version must be semver string like 1.0.0');
    }
    const doc = new this.contractModel({
      json,
      version,
      meta: { ...(meta || {}), updatedAt: new Date() },
      userId: userId ? new MongooseTypes.ObjectId(userId) : undefined,
      createdBy: new MongooseTypes.ObjectId(createdBy),
    });
    await doc.save();
    return doc;
  }

  async findById(id: string) {
    const doc = await this.contractModel.findById(
      new MongooseTypes.ObjectId(id),
    );
    if (!doc) throw new NotFoundException('Contract not found');
    return doc;
  }

  async findLatest() {
    const doc = await this.contractModel.findOne().sort({ createdAt: -1 });
    return doc;
  }

  async findLatestByUser(userId: string) {
    const doc = await this.contractModel
      .findOne({ userId: new MongooseTypes.ObjectId(userId) })
      .sort({ createdAt: -1 });
    return doc;
  }
}
