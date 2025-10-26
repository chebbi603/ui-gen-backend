import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { getModelToken } from '@nestjs/mongoose';
import { User } from '../entities/user.entity';
import * as bcrypt from 'bcrypt';
jest.mock('bcrypt');

describe('UserService (unit)', () => {
  let service: UserService;

  const MockModel: any = jest.fn(function (this: any, doc: any) {
    Object.assign(this, doc);
    this.save = jest.fn().mockResolvedValue(this);
  });
  MockModel.create = jest.fn();
  MockModel.find = jest.fn();
  MockModel.findById = jest.fn();
  MockModel.findByIdAndUpdate = jest.fn();
  MockModel.findByIdAndDelete = jest.fn();
  MockModel.findOne = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getModelToken(User.name), useValue: MockModel },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  describe('create', () => {
    it('hashes password and sets default role', async () => {
      (bcrypt.genSalt as unknown as jest.Mock).mockResolvedValue('salt');
      (bcrypt.hash as unknown as jest.Mock).mockResolvedValue('hashed');
      MockModel.findOne.mockResolvedValue(null);

      await service.create({ email: 'a@b.c', password: 'p', username: 'u' } as any);

      expect(MockModel).toHaveBeenCalledWith(expect.objectContaining({ email: 'a@b.c', username: 'u' }));
      const instance = (MockModel as jest.Mock).mock.instances[0];
      expect(instance.password).toBe('hashed');
      expect(instance.role).toBe('USER');
      expect(instance.save).toHaveBeenCalled();
    });

    it('throws conflict when email exists', async () => {
      MockModel.findOne.mockResolvedValue({ _id: 'existing' });
      await expect(service.create({ email: 'dup@b.c', password: 'p', username: 'u' } as any)).rejects.toThrow();
    });
  });

  describe('findAll', () => {
    it('returns a query for users list', async () => {
      const q = { exec: jest.fn() };
      MockModel.find.mockReturnValue(q);
      const res = await service.findAll();
      expect(MockModel.find).toHaveBeenCalledWith({});
      expect(res).toBe(q);
      expect((res as any).exec).toBeDefined();
    });
  });

  describe('findOne', () => {
    it('returns a query by id', () => {
      const q = { exec: jest.fn() };
      MockModel.findById.mockReturnValue(q);
      const res = service.findOne('507f1f77bcf86cd799439011');
      expect(MockModel.findById).toHaveBeenCalled();
      expect(res).toBe(q);
      expect((res as any).exec).toBeDefined();
    });
  });

  describe('update', () => {
    it('updates allowed fields and calls save', async () => {
      const user: any = { username: 'old', email: 'old@b.c', role: 'USER', save: jest.fn() };
      MockModel.findById.mockResolvedValue(user);
      await service.update('507f1f77bcf86cd799439011', { email: 'new@b.c', role: 'ADMIN' } as any);
      expect(user.email).toBe('new@b.c');
      expect(user.role).toBe('USER');
      expect(user.save).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes by id', async () => {
      MockModel.findByIdAndDelete.mockResolvedValue({ _id: 'u1' });
      await service.remove('507f1f77bcf86cd799439011');
      expect(MockModel.findByIdAndDelete).toHaveBeenCalled();
    });
  });
});
