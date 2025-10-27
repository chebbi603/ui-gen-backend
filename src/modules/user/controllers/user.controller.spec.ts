import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from '../services/user.service';
import { ContractService } from '../../contract/services/contract.service';
import { EventService } from '../../event/services/event.service';

describe('UserController', () => {
  let controller: UserController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        { provide: UserService, useValue: {} },
        {
          provide: ContractService,
          useValue: { findLatestByUser: jest.fn(), create: jest.fn() },
        },
        {
          provide: EventService,
          useValue: { getLastForUser: jest.fn(), listByUser: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
