import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types as MongooseTypes } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User } from '../../user/entities/user.entity';
import { Contract } from '../../contract/entities/contract.entity';
import { Event } from '../../event/entities/event.entity';
import { ConfigService } from '@nestjs/config';
import { UserContract } from '../../user-contract/entities/user-contract.entity';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Contract.name) private readonly contractModel: Model<Contract>,
    @InjectModel(Event.name) private readonly eventModel: Model<Event>,
    private readonly config: ConfigService,
    @InjectModel(UserContract.name)
    private readonly userContractModel: Model<UserContract>,
  ) {}

  async onApplicationBootstrap() {
    try {
      const env =
        this.config.get<string>('NODE_ENV') ||
        process.env.NODE_ENV ||
        'development';
      const seedEnabled = this.config.get<string>('SEED_ENABLED') === 'true';
      if (env === 'production' && !seedEnabled) {
        this.logger.log('Seeding skipped (production or disabled)');
        return;
      }
      await this.seed();
    } catch (err) {
      this.logger.error('Seeding failed', err as any);
    }
  }

  private async seed() {
    // Idempotent seed: create if missing
    const email = 'test@example.com';
    let user = await this.userModel.findOne({ email });

    if (!user) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('password123', salt);

      user = new this.userModel({
        email,
        username: 'TestUser',
        name: 'Test User',
        password: passwordHash,
        passwordHash,
        role: 'USER',
      });
      await user.save();
      this.logger.log(`Seeded user ${email}`);
    }

    let contract = await this.contractModel.findOne({ version: '1.0.0' });
    if (!contract) {
      contract = new this.contractModel({
        json: {
          screens: [
            { id: 'home', components: [{ id: 'button1', type: 'button' }] },
          ],
        },
        version: '1.0.0',
        meta: {
          name: 'Default App Contract',
          description: 'Canonical UI config for testing',
          author: 'seed',
          updatedAt: new Date(),
        },
        createdBy: user._id as MongooseTypes.ObjectId,
      });
      await contract.save();
      this.logger.log('Seeded default contract v1.0.0');
    }

    // Seed a personalized user contract
    const existingUserContract = await this.userContractModel.findOne({
      userId: user._id,
      contractId: contract._id,
    });
    if (!existingUserContract) {
      await this.userContractModel.create({
        userId: user._id as MongooseTypes.ObjectId,
        contractId: contract._id as MongooseTypes.ObjectId,
        json: {
          screens: [
            {
              id: 'home',
              components: [
                { id: 'button1', type: 'button', label: 'Click Me!' },
              ],
            },
          ],
        },
      });
      this.logger.log('Seeded personalized user contract');
    }

    const existingEvents = await this.eventModel.countDocuments({
      userId: user._id,
    });
    if (existingEvents < 2) {
      await this.eventModel.create([
        {
          userId: user._id as MongooseTypes.ObjectId,
          timestamp: new Date(),
          componentId: 'home',
          eventType: 'view',
          data: { page: 'home' },
        },
        {
          userId: user._id as MongooseTypes.ObjectId,
          timestamp: new Date(),
          componentId: 'button1',
          eventType: 'tap',
          data: { page: 'home', value: 'cta' },
        },
      ]);
      this.logger.log('Seeded sample events');
    }
  }
}
