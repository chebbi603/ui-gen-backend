import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Session, SessionSchema } from './entities/session.entity';
import { SessionService } from './services/session.service';
import { SessionController } from './controllers/session.controller';
import { EventModule } from '../event/event.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Session.name, schema: SessionSchema }]),
    EventModule,
  ],
  providers: [SessionService],
  controllers: [SessionController],
  exports: [MongooseModule, SessionService],
})
export class SessionModule {}