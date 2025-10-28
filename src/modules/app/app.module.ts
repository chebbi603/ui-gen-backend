import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './controllers/app.controller';
import { AppService } from './services/app.service';
import { UserModule } from '../user/user.module';
import { AuthModule } from '../auth/auth.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as Joi from 'joi';
import config from '../../config';
import { ContractModule } from '../contract/contract.module';
import { UserContractModule } from '../user-contract/user-contract.module';
import { EventModule } from '../event/event.module';
import { SessionModule } from '../session/session.module';
import { SeedService } from './services/seed.service';
import { User, UserSchema } from '../user/entities/user.entity';
import { Contract, ContractSchema } from '../contract/entities/contract.entity';
import { Event, EventSchema } from '../event/entities/event.entity';
import {
  UserContract,
  UserContractSchema,
} from '../user-contract/entities/user-contract.entity';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: config,
      envFilePath: ['.env'],
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
        PORT: Joi.number().port().optional(),
        MONGO_URL: Joi.string().uri({ scheme: ['mongodb', 'mongodb+srv', 'http', 'https'] }).required(),
        MONGO_DATABASE_NAME: Joi.string().min(1).required(),
        JWT_SECRET: Joi.string().min(32).when('NODE_ENV', {
          is: 'production',
          then: Joi.required(),
          otherwise: Joi.optional(),
        }),
        JWT_EXPIRES_IN: Joi.string().optional(),
        // Messaging
        RABBITMQ_URL: Joi.string().optional(),
        RABBITMQ_TOPIC: Joi.string().optional(),
        // Redis (either URL or host/port set)
        REDIS_URL: Joi.string().optional(),
        REDIS_HOST: Joi.string().optional(),
        REDIS_PORT: Joi.number().optional(),
        REDIS_PASSWORD: Joi.string().optional(),
        REDIS_DB: Joi.number().optional(),
        // LLM providers
        LLM_PROVIDER: Joi.string().valid('openai', 'anthropic').optional(),
        OPENAI_API_KEY: Joi.string().when('LLM_PROVIDER', {
          is: 'openai',
          then: Joi.string().when('NODE_ENV', {
            is: 'production',
            then: Joi.required(),
            otherwise: Joi.optional(),
          }),
          otherwise: Joi.optional(),
        }),
        OPENAI_MODEL: Joi.string().optional(),
        OPENAI_BASE_URL: Joi.string().optional(),
        ANTHROPIC_API_KEY: Joi.string().when('LLM_PROVIDER', {
          is: 'anthropic',
          then: Joi.string().when('NODE_ENV', {
            is: 'production',
            then: Joi.required(),
            otherwise: Joi.optional(),
          }),
          otherwise: Joi.optional(),
        }),
        ANTHROPIC_MODEL: Joi.string().optional(),
        ANTHROPIC_BASE_URL: Joi.string().optional(),
        // Seeding flag
        SEED_ENABLED: Joi.boolean().optional(),
      }),
    }),
    UserModule,
    AuthModule,
    ContractModule,
    UserContractModule,
    EventModule,
    SessionModule,
    LlmModule,
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('database.uri'),
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Contract.name, schema: ContractSchema },
      { name: Event.name, schema: EventSchema },
      { name: UserContract.name, schema: UserContractSchema },
    ]),
  ],
  controllers: [AppController],
  providers: [AppService, SeedService],
})
export class AppModule {}
