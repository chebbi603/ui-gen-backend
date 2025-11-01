import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types as MongooseTypes } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User } from '../../user/entities/user.entity';
import { Contract } from '../../contract/entities/contract.entity';
import { Event } from '../../event/entities/event.entity';
import { ConfigService } from '@nestjs/config';
import { UserContract } from '../../user-contract/entities/user-contract.entity';
import { CacheService } from '../../../common/services/cache.service';

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
    private readonly cache: CacheService,
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
        passwordHash,
        role: 'ADMIN',
      });
      await user.save();
      this.logger.log(`Seeded user ${email}`);
    } else {
      // Ensure the seeded user has ADMIN role for dashboard access
      if ((user as any).role !== 'ADMIN') {
        (user as any).role = 'ADMIN';
        await user.save();
        this.logger.log(`Updated user ${email} to ADMIN`);
      }
    }

    let contract = await this.contractModel.findOne({ version: '1.0.0' });
    if (!contract) {
      contract = new this.contractModel({
        json: {
          meta: {
            appName: 'Demo Canonical App',
            version: '1.0.0',
            schemaVersion: '1.0.0',
            generatedAt: new Date().toISOString(),
            authors: ['seed'],
            description: 'Canonical UI config for testing',
          },
          services: {
            auth: {
              baseUrl: 'http://localhost:8081',
              endpoints: {
                login: { path: '/auth/login', method: 'POST' },
                refresh: { path: '/auth/refresh', method: 'POST' },
              },
            },
          },
          pagesUI: {
            routes: {
              '/': { pageId: 'home' },
              '/profile': { pageId: 'profile' },
              '/form': { pageId: 'form' },
            },
            bottomNavigation: {
              enabled: true,
              initialIndex: 0,
              items: [
                { pageId: 'home', title: 'Home', icon: 'home' },
                { pageId: 'profile', title: 'Profile', icon: 'person' },
                { pageId: 'form', title: 'Form', icon: 'doc_text' },
              ],
            },
            pages: {
              home: {
                id: 'home',
                title: 'Home',
                layout: 'scroll',
                navigationBar: { title: 'Demo Home' },
                children: [
                  { type: 'text', text: 'Welcome to the Demo Canonical App' },
                  {
                    type: 'textButton',
                    text: 'Go to Profile',
                    onTap: { action: 'navigate', route: '/profile' },
                  },
                ],
              },
              profile: {
                id: 'profile',
                title: 'Profile',
                layout: 'column',
                navigationBar: { title: 'Profile' },
                children: [
                  {
                    type: 'image',
                    src: 'https://picsum.photos/200',
                    style: { width: 150, height: 150 },
                  },
                  { type: 'text', text: 'Name: John Doe' },
                  { type: 'icon', name: 'person_circle', size: 32 },
                ],
              },
              form: {
                id: 'form',
                title: 'Form',
                layout: 'scroll',
                navigationBar: { title: 'Form' },
                children: [
                  {
                    type: 'form',
                    children: [
                      {
                        type: 'textField',
                        id: 'fullName',
                        label: 'Full Name',
                        placeholder: 'Jane Doe',
                        validation: { required: true, message: 'Name is required' },
                      },
                      {
                        type: 'textField',
                        id: 'email',
                        label: 'Email',
                        placeholder: 'you@example.com',
                        validation: { email: true, required: true, message: 'Valid email required' },
                      },
                      {
                        type: 'button',
                        text: 'Submit',
                        onTap: { action: 'submitForm', params: { formId: 'form' } },
                      },
                    ],
                  },
                ],
              },
            },
          },
          analytics: {
            backendUrl: 'http://localhost:8081/events',
            trackedComponents: ['fullName', 'email'],
          },
          state: {
            global: {
              welcomeMessage: {
                type: 'string',
                default: 'Welcome to the Demo Canonical App',
              },
            },
          },
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
      // Clear canonical cache so new schema is served immediately
      await this.cache.del('contracts:canonical');
      this.logger.log('Seeded default canonical contract v1.0.0');
    } else {
      // Update existing canonical v1.0.0 to the optimized schema
      contract.json = {
        meta: {
          appName: 'Demo Canonical App',
          version: '1.0.0',
          schemaVersion: '1.0.0',
          generatedAt: new Date().toISOString(),
          authors: ['seed'],
          description: 'Canonical UI config for testing',
        },
        services: {
          auth: {
            baseUrl: 'http://localhost:8081',
            endpoints: {
              login: { path: '/auth/login', method: 'POST' },
              refresh: { path: '/auth/refresh', method: 'POST' },
            },
          },
        },
        pagesUI: {
          routes: {
            '/': { pageId: 'home' },
            '/profile': { pageId: 'profile' },
            '/form': { pageId: 'form' },
          },
          bottomNavigation: {
            enabled: true,
            initialIndex: 0,
            items: [
              { pageId: 'home', title: 'Home', icon: 'home' },
              { pageId: 'profile', title: 'Profile', icon: 'person' },
              { pageId: 'form', title: 'Form', icon: 'doc_text' },
            ],
          },
          pages: {
            home: {
              id: 'home',
              title: 'Home',
              layout: 'scroll',
              navigationBar: { title: 'Demo Home' },
              children: [
                { type: 'text', text: 'Welcome to the Demo Canonical App' },
                {
                  type: 'textButton',
                  text: 'Go to Profile',
                  onTap: { action: 'navigate', route: '/profile' },
                },
              ],
            },
            profile: {
              id: 'profile',
              title: 'Profile',
              layout: 'column',
              navigationBar: { title: 'Profile' },
              children: [
                {
                  type: 'image',
                  src: 'https://picsum.photos/200',
                  style: { width: 150, height: 150 },
                },
                { type: 'text', text: 'Name: John Doe' },
                { type: 'icon', name: 'person_circle', size: 32 },
              ],
            },
            form: {
              id: 'form',
              title: 'Form',
              layout: 'scroll',
              navigationBar: { title: 'Form' },
              children: [
                {
                  type: 'form',
                  children: [
                    {
                      type: 'textField',
                      id: 'fullName',
                      label: 'Full Name',
                      placeholder: 'Jane Doe',
                      validation: { required: true, message: 'Name is required' },
                    },
                    {
                      type: 'textField',
                      id: 'email',
                      label: 'Email',
                      placeholder: 'you@example.com',
                      validation: { email: true, required: true, message: 'Valid email required' },
                    },
                    {
                      type: 'button',
                      text: 'Submit',
                      onTap: { action: 'submitForm', params: { formId: 'form' } },
                    },
                  ],
                },
              ],
            },
          },
        },
        analytics: {
          backendUrl: 'http://localhost:8081/events',
          trackedComponents: ['fullName', 'email'],
        },
        state: {
          global: {
            welcomeMessage: {
              type: 'string',
              default: 'Welcome to the Demo Canonical App',
            },
          },
        },
      };
      contract.meta = {
        ...(contract.meta || {}),
        name: 'Default App Contract',
        description: 'Canonical UI config for testing',
        author: 'seed',
        updatedAt: new Date(),
      };
      await contract.save();
      // Clear canonical cache so updated schema is served
      await this.cache.del('contracts:canonical');
      this.logger.log('Updated canonical contract v1.0.0 to optimized schema');
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
