import { Test, TestingModule } from '@nestjs/testing';
import { EventService } from './event.service';
import { getModelToken } from '@nestjs/mongoose';
import { Event } from '../entities/event.entity';
import { ForbiddenException } from '@nestjs/common';

describe('EventService (unit)', () => {
  let service: EventService;

  const MockModel: any = jest.fn();
  MockModel.insertMany = jest.fn();
  MockModel.find = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventService,
        { provide: getModelToken(Event.name), useValue: MockModel },
      ],
    }).compile();

    service = module.get<EventService>(EventService);
  });

  it('createBatch inserts transformed events and returns count', async () => {
    MockModel.insertMany.mockResolvedValue(undefined);
    const res = await service.createBatch('507f1f77bcf86cd799439011', [
      { timestamp: new Date().toISOString(), componentId: 'c1', eventType: 'tap' },
      { timestamp: new Date().toISOString(), componentId: 'c2', eventType: 'view', data: { x: 1 } },
    ]);
    expect(MockModel.insertMany).toHaveBeenCalled();
    const args = MockModel.insertMany.mock.calls[0][0];
    expect(args).toHaveLength(2);
    expect(args[0]).toEqual(expect.objectContaining({ componentId: 'c1', eventType: 'tap', data: {} }));
    expect(args[0].timestamp).toBeInstanceOf(Date);
    expect(res).toEqual({ inserted: 2 });
  });

  it('listByUser forbids non-owner non-admin', async () => {
    await expect(service.listByUser('507f1f77bcf86cd799439011', 'USER', '507f1f77bcf86cd799439012')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('listByUser returns find() results for owner or admin', async () => {
    const sort = jest.fn().mockResolvedValue(['e1']);
    MockModel.find.mockReturnValue({ sort } as any);
    const ownerRes = await service.listByUser('507f1f77bcf86cd799439011', 'USER', '507f1f77bcf86cd799439011');
    expect(ownerRes).toEqual(['e1']);
    const adminRes = await service.listByUser('507f1f77bcf86cd799439013', 'ADMIN', '507f1f77bcf86cd799439012');
    expect(adminRes).toEqual(['e1']);
  });
});