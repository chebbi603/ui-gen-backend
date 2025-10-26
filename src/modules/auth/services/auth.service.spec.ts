import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from '../../user/services/user.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
jest.mock('bcrypt');

describe('AuthService (unit)', () => {
  let service: AuthService;
  const mockUserService = {
    findByEmail: jest.fn(),
    create: jest.fn(),
  } as any;
  const mockJwt = {
    sign: jest.fn().mockReturnValue('signed-token'),
  } as any;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: mockUserService },
        { provide: JwtService, useValue: mockJwt },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('validateUser', () => {
    it('returns sanitized user when password matches', async () => {
      const user: any = { _id: 'u1', email: 'a@b.c', password: 'hash', role: 'USER' };
      mockUserService.findByEmail.mockResolvedValue({ ...user });
      (bcrypt.compare as unknown as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('a@b.c', 'password');
      expect(result).toBeDefined();
      expect(result._id).toBe('u1');
      expect((result as any).password).toBeUndefined();
      expect(mockUserService.findByEmail).toHaveBeenCalledWith('a@b.c');
    });

    it('returns null when password mismatch or user missing', async () => {
      mockUserService.findByEmail.mockResolvedValue({ _id: 'u1', email: 'x@y.z', password: 'hash' });
      (bcrypt.compare as unknown as jest.Mock).mockResolvedValue(false);
      const result1 = await service.validateUser('x@y.z', 'wrong');
      expect(result1).toBeNull();

      mockUserService.findByEmail.mockResolvedValue(null);
      const result2 = await service.validateUser('x@y.z', 'any');
      expect(result2).toBeNull();
    });
  });

  describe('login', () => {
    it('returns accessToken and role with id', async () => {
      const user: any = { _id: 'u1', id: 'u1', email: 'a@b.c', role: 'ADMIN' };
      const res = await service.login(user);
      expect(res).toEqual({ _id: 'u1', role: 'ADMIN', accessToken: 'signed-token' });
      expect(mockJwt.sign).toHaveBeenCalledWith({ email: 'a@b.c', sub: 'u1', role: 'ADMIN' });
    });
  });

  describe('signUp', () => {
    it('delegates to userService.create', async () => {
      const dto: any = { email: 'a@b.c', password: 'p', username: 'u' };
      await service.signUp(dto);
      expect(mockUserService.create).toHaveBeenCalledWith(dto);
    });
  });
});
