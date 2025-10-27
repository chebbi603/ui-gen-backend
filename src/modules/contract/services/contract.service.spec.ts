import { Test, TestingModule } from '@nestjs/testing';
import { ContractService } from './contract.service';
import { getModelToken } from '@nestjs/mongoose';
import { Contract } from '../entities/contract.entity';
import { BadRequestException, NotFoundException } from '@nestjs/common';

jest.mock('../../../common/validators/contract.validator', () => ({
  validateContractJson: jest.fn(),
}));
import { validateContractJson } from '../../../common/validators/contract.validator';

describe('ContractService (unit)', () => {
  let service: ContractService;

  const MockModel: any = jest.fn(function (this: any, doc: any) {
    Object.assign(this, doc);
    this.save = jest.fn().mockResolvedValue(this);
  });
  MockModel.findById = jest.fn();
  MockModel.findOne = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractService,
        { provide: getModelToken(Contract.name), useValue: MockModel },
      ],
    }).compile();

    service = module.get<ContractService>(ContractService);
  });

  it('create validates json and version, then saves', async () => {
    (validateContractJson as jest.Mock).mockReturnValue({
      valid: true,
      errors: [],
    });
    await service.create(
      { screen: [] },
      '1.0.0',
      { name: 'abc' },
      '507f1f77bcf86cd799439011',
    );
    const instance = (MockModel as jest.Mock).mock.instances[0];
    expect(instance.save).toHaveBeenCalled();
    expect(instance.version).toBe('1.0.0');
    expect(instance.meta).toHaveProperty('updatedAt');
    expect(instance.createdBy.toString()).toHaveLength(24);
  });

  it('create throws BadRequestException for invalid json', async () => {
    (validateContractJson as jest.Mock).mockReturnValue({
      valid: false,
      errors: ['bad'],
    });
    await expect(
      service.create({}, '1.0.0', {}, '507f1f77bcf86cd799439011'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create throws BadRequestException for invalid version', async () => {
    (validateContractJson as jest.Mock).mockReturnValue({
      valid: true,
      errors: [],
    });
    await expect(
      service.create({}, 'v1', {}, '507f1f77bcf86cd799439011'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('findById returns doc or throws NotFound', async () => {
    const oid = '507f1f77bcf86cd799439011';
    MockModel.findById.mockResolvedValue(null);
    await expect(service.findById(oid)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    MockModel.findById.mockResolvedValue({ _id: oid });
    expect(await service.findById(oid)).toEqual({ _id: oid });
  });

  it('findLatest delegates to findOne().sort()', async () => {
    const sort = jest.fn().mockResolvedValue('doc');
    MockModel.findOne.mockReturnValue({ sort } as any);
    const res = await service.findLatest();
    expect(MockModel.findOne).toHaveBeenCalled();
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(res).toBe('doc');
  });
});
