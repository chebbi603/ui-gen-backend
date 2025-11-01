import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Event, EventSchema } from './entities/event.entity';
import { EventService } from './services/event.service';
import { EventController } from './controllers/event.controller';
import { CacheService } from '../../common/services/cache.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Event.name, schema: EventSchema }]),
  ],
  providers: [EventService, CacheService],
  controllers: [EventController],
  exports: [MongooseModule, EventService],
})
export class EventModule {}
