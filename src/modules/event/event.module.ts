import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Event, EventSchema } from './entities/event.entity';
import { EventService } from './services/event.service';
import { EventController } from './controllers/event.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: Event.name, schema: EventSchema }])],
  providers: [EventService],
  controllers: [EventController],
  exports: [MongooseModule, EventService],
})
export class EventModule {}