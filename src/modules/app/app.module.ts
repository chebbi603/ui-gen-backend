import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './controllers/app.controller';
import { AppService } from './services/app.service';
import { UserModule } from '../user/user.module';
import { AuthModule } from '../auth/auth.module';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import config from '../../config';
import { ContractModule } from '../contract/contract.module';
import { UserContractModule } from '../user-contract/user-contract.module';
import { EventModule } from '../event/event.module';
import { SessionModule } from '../session/session.module';
import { SeedService } from './services/seed.service';
import { User, UserSchema } from '../user/entities/user.entity';
import { Contract, ContractSchema } from '../contract/entities/contract.entity';
import { Event, EventSchema } from '../event/entities/event.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: config,
    }),
    UserModule,
    AuthModule,
    ContractModule,
    UserContractModule,
    EventModule,
    SessionModule,
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
    ]),
  ],
  controllers: [AppController],
  providers: [AppService, SeedService],
})
export class AppModule {}
