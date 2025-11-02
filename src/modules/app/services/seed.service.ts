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
import * as fs from 'fs';
import * as path from 'path';

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
    // Attempt to load canonical and personalized contracts from disk
    const canonicalCandidates = [
      // When running from compiled dist
      path.resolve(__dirname, '../data/canonical-contract-v1.json'),
      // When running with ts-node/nest CLI in dev
      path.resolve(process.cwd(), 'src/modules/app/data/canonical-contract-v1.json'),
    ];
    const personalizedCandidates = [
      path.resolve(__dirname, '../data/personalized-contract-example.json'),
      path.resolve(process.cwd(), 'src/modules/app/data/personalized-contract-example.json'),
    ];
    let canonicalJson: Record<string, unknown> | null = null;
    let canonicalVersion = '1.0.0';
    try {
      const canonicalPath = canonicalCandidates.find((p) => fs.existsSync(p));
      if (canonicalPath) {
        const raw = fs.readFileSync(canonicalPath, 'utf8');
        const parsed = JSON.parse(raw);
        canonicalJson = parsed;
        // Try to derive version from meta.version if present
        const v = (parsed as any)?.meta?.version;
        if (typeof v === 'string' && /^\d+\.\d+\.\d+$/.test(v)) {
          canonicalVersion = v;
        }
        this.logger.log(
          `Loaded canonical contract from disk (version=${canonicalVersion})`,
        );
      } else {
        this.logger.warn(
          `Canonical contract file not found at any candidate path; using built-in seed`,
        );
      }
    } catch (e: any) {
      this.logger.warn(
        `Failed to read canonical contract from disk: ${e?.message || e}`,
      );
    }
    let personalizedJson: Record<string, unknown> | null = null;
    try {
      const personalizedPath = personalizedCandidates.find((p) => fs.existsSync(p));
      if (personalizedPath) {
        const raw = fs.readFileSync(personalizedPath, 'utf8');
        personalizedJson = JSON.parse(raw);
        this.logger.log('Loaded personalized contract override from disk');
      }
    } catch (e: any) {
      this.logger.warn(
        `Failed to read personalized contract from disk: ${e?.message || e}`,
      );
    }
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

    let contract = await this.contractModel.findOne({ version: canonicalVersion });
    if (!contract) {
      contract = new this.contractModel({
        json: canonicalJson ?? {
          meta: {
            appName: 'Demo Canonical App',
            version: canonicalVersion,
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
        version: canonicalVersion,
        meta: {
          name: canonicalJson ? 'Canonical Contract (disk)' : 'Default App Contract',
          description: canonicalJson
            ? 'Canonical UI config loaded from disk file'
            : 'Canonical UI config for testing',
          author: 'seed',
          updatedAt: new Date(),
        },
        createdBy: user._id as MongooseTypes.ObjectId,
      });
      await contract.save();
      // Clear canonical cache so new schema is served immediately
      await this.cache.del('contracts:canonical');
      this.logger.log(`Seeded canonical contract v${canonicalVersion} (${canonicalJson ? 'disk' : 'built-in'})`);
    } else {
      // Update existing canonical v1.0.0 to the optimized schema
      contract.json = canonicalJson ?? {
        meta: {
          appName: 'Demo Canonical App',
          version: canonicalVersion,
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
        name: canonicalJson ? 'Canonical Contract (disk)' : 'Default App Contract',
        description: canonicalJson
          ? 'Canonical UI config loaded from disk file'
          : 'Canonical UI config for testing',
        author: 'seed',
        updatedAt: new Date(),
      };
      await contract.save();
      // Clear canonical cache so updated schema is served
      await this.cache.del('contracts:canonical');
      this.logger.log(`Updated canonical contract v${canonicalVersion} (${canonicalJson ? 'disk' : 'built-in'})`);
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
        json: personalizedJson ?? {
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
      this.logger.log(
        `Seeded personalized user contract (${personalizedJson ? 'disk' : 'minimal'})`,
      );
    }

    // Also seed a personalized contract in the main contracts collection (used by UserController merge)
    const existingPersonalizedInContracts = await this.contractModel
      .findOne({ userId: user._id })
      .sort({ createdAt: -1 });
    if (!existingPersonalizedInContracts) {
      const pVersion = (personalizedJson as any)?.meta?.version;
      await this.contractModel.create({
        json: personalizedJson ?? {
          pagesUI: {
            pages: {
              home: {
                id: 'home',
                title: 'Dashboard',
                scope: 'authenticated',
              },
            },
          },
        },
        version:
          typeof pVersion === 'string' && /^\d+\.\d+\.\d+$/.test(pVersion)
            ? pVersion
            : '1.0.1',
        meta: {
          name: personalizedJson
            ? 'User Personalized Contract (disk)'
            : 'User Personalized Contract (minimal)',
          description: personalizedJson
            ? 'Partial override loaded from disk file'
            : 'Basic personalized contract for testing',
          author: 'seed',
          updatedAt: new Date(),
        },
        userId: user._id as MongooseTypes.ObjectId,
        createdBy: user._id as MongooseTypes.ObjectId,
      });
      // Invalidate cache for this user's merged contract if present
      await this.cache.del(`contracts:user:${user._id.toString()}`);
      this.logger.log(
        `Seeded personalized contract in contracts collection (${personalizedJson ? 'disk' : 'minimal'})`,
      );
    }

    // Optional: seed a couple of sample analytics events only when explicitly enabled
    const seedSampleEvents =
      this.config.get<string>('SEED_SAMPLE_EVENTS') === 'true' ||
      process.env.SEED_SAMPLE_EVENTS === 'true';
    if (seedSampleEvents) {
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
        this.logger.log('Seeded sample events (enabled via SEED_SAMPLE_EVENTS)');
      } else {
        this.logger.log('Skipping sample events seeding (already present)');
      }
    } else {
      this.logger.log('Sample events seeding disabled (SEED_SAMPLE_EVENTS!=true)');
    }
  }
}
