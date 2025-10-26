import { Test, TestingModule } from '@nestjs/testing';
import { UserContractService } from './user-contract.service';
import { getModelToken } from '@nestjs/mongoose';
import { UserContract } from '../entities/user-contract.entity';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

jest.mock('../../../common/validators/contract.validator', () => ({
  validateContractJson: jest.fn(),
}));
import { validateContractJson } from '../../../common/validators/contract.validator';

describe('UserContractService (unit)', () => {
  let service: UserContractService;

  const MockModel: any = jest.fn();
  MockModel.findOne = jest.fn();
  MockModel.findOneAndUpdate = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserContractService,
        { provide: getModelToken(UserContract.name), useValue: MockModel },
      ],
    }).compile();

    service = module.get<UserContractService>(UserContractService);
  });

  it('getUserContract delegates to findOne()', async () => {
    const sort = jest.fn().mockResolvedValue('doc');
    MockModel.findOne.mockReturnValue({ sort } as any);
    const res = await service.getUserContract('507f1f77bcf86cd799439011');
    expect(MockModel.findOne).toHaveBeenCalled();
    expect(sort).toHaveBeenCalledWith({ updatedAt: -1 });
    expect(res).toBe('doc');
  });

  it('upsertUserContract denies when requester is not owner nor admin', async () => {
    (validateContractJson as jest.Mock).mockReturnValue({ valid: true });
    await expect(
      service.upsertUserContract('507f1f77bcf86cd799439011', undefined, { a: 1 }, '507f1f77bcf86cd799439012', 'USER'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('upsertUserContract validates json and upserts when allowed', async () => {
    (validateContractJson as jest.Mock).mockReturnValue({ valid: true });
    MockModel.findOneAndUpdate.mockResolvedValue({ _id: 'x', json: { ok: true } });
    const res = await service.upsertUserContract('507f1f77bcf86cd799439011', undefined, { screens: [] }, '507f1f77bcf86cd799439011', 'USER');
    expect(MockModel.findOneAndUpdate).toHaveBeenCalled();
    expect(res).toEqual({ _id: 'x', json: { ok: true } });
  });

  it('upsertUserContract rejects invalid json', async () => {
    (validateContractJson as jest.Mock).mockReturnValue({ valid: false, errors: ['bad'] });
    await expect(service.upsertUserContract('507f1f77bcf86cd799439011', undefined, {}, '507f1f77bcf86cd799439011', 'ADMIN')).rejects.toBeInstanceOf(BadRequestException);
  });
});