import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from '../../user/services/user.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ContractService } from '../../contract/services/contract.service';
import * as bcrypt from 'bcrypt';
jest.mock('bcrypt');
// Stub @nestjs/jwt to avoid loading jsonwebtoken/jwa in tests
jest.mock('@nestjs/jwt', () => ({
  JwtService: class JwtService {},
}));

describe('AuthService (unit)', () => {
  let service: AuthService;
  const mockUserService = {
    findByEmail: jest.fn(),
    create: jest.fn(),
  } as any;
  const mockJwt = {
    sign: jest.fn().mockReturnValue('signed-token'),
  } as any;
  const mockConfig: any = { get: jest.fn() };
  const mockContract: any = {
    findLatestCanonical: jest.fn(),
    create: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: mockUserService },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: ContractService, useValue: mockContract },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('validateUser', () => {
    it('returns sanitized user when password matches', async () => {
      const user: any = {
        _id: 'u1',
        email: 'a@b.c',
        passwordHash: 'hash',
        role: 'USER',
      };
      mockUserService.findByEmail.mockResolvedValue({ ...user });
      (bcrypt.compare as unknown as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('a@b.c', 'password');
      expect(result).toBeDefined();
      expect(result._id).toBe('u1');
      expect((result as any).passwordHash).toBeUndefined();
      expect(mockUserService.findByEmail).toHaveBeenCalledWith('a@b.c');
    });

    it('returns null when password mismatch or user missing', async () => {
      mockUserService.findByEmail.mockResolvedValue({
        _id: 'u1',
        email: 'x@y.z',
        passwordHash: 'hash',
      });
      (bcrypt.compare as unknown as jest.Mock).mockResolvedValue(false);
      const result1 = await service.validateUser('x@y.z', 'wrong');
      expect(result1).toBeNull();

      mockUserService.findByEmail.mockResolvedValue(null);
      const result2 = await service.validateUser('x@y.z', 'any');
      expect(result2).toBeNull();
    });
  });

  describe('login', () => {
    it('returns accessToken and role with userId', async () => {
      // Arrange config and bcrypt mocks for refresh token flow
      mockConfig.get.mockImplementation((key: string) => {
        if (key === 'auth.jwt.refreshSecret') return 'test-refresh-secret';
        if (key === 'auth.jwt.refreshExpiresIn') return '1h';
        return undefined;
      });
      (bcrypt.genSalt as unknown as jest.Mock).mockResolvedValue('salt');
      (bcrypt.hash as unknown as jest.Mock).mockResolvedValue('hashed');
      (mockUserService as any).addRefreshToken = jest
        .fn()
        .mockResolvedValue(undefined);

      const user: any = { _id: 'u1', id: 'u1', email: 'a@b.c', role: 'ADMIN' };
      const res = await service.login(user);
      expect(res).toEqual({
        userId: 'u1',
        role: 'ADMIN',
        accessToken: 'signed-token',
        refreshToken: 'signed-token',
      });
      expect(mockJwt.sign).toHaveBeenCalledWith({
        email: 'a@b.c',
        sub: 'u1',
        role: 'ADMIN',
      });
    });
  });

  describe('signUp', () => {
    it('delegates to userService.create', async () => {
      const dto: any = { email: 'a@b.c', password: 'p', username: 'u' };
      mockContract.findLatestCanonical.mockResolvedValue(null);
      mockUserService.findByEmail.mockResolvedValue({ _id: 'u1', email: 'a@b.c' });
      await service.signUp(dto);
      expect(mockUserService.create).toHaveBeenCalledWith(dto);
    });

    it('assigns default contract when canonical exists', async () => {
      const dto: any = { email: 'new@b.c', password: 'p', username: 'u' };
      mockUserService.findByEmail.mockResolvedValue({ _id: 'u1', email: 'new@b.c' });
      mockContract.findLatestCanonical.mockResolvedValue({ json: { meta: {}, pagesUI: { pages: {} } }, version: '1.0.0', meta: { name: 'App' } });
      await service.signUp(dto);
      expect(mockUserService.create).toHaveBeenCalledWith(dto);
      expect(mockContract.create).toHaveBeenCalledWith(
        expect.any(Object),
        '0.0.0',
        expect.objectContaining({ source: 'auto-register', baseVersion: '1.0.0' }),
        'u1',
        'u1',
      );
    });
  });
});
