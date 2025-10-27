import { UnauthorizedException } from '@nestjs/common';
import { LocalStrategy } from './local.strategy';
import { AuthService } from '../services/auth.service';

describe('LocalStrategy', () => {
  let strategy: LocalStrategy;
  const mockAuth = { validateUser: jest.fn() } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    strategy = new LocalStrategy(mockAuth as AuthService);
  });

  it('returns user when credentials are valid', async () => {
    const user = { _id: 'u1', email: 'a@b.c' };
    mockAuth.validateUser.mockResolvedValue(user);
    const res = await strategy.validate('a@b.c', 'p');
    expect(res).toBe(user);
    expect(mockAuth.validateUser).toHaveBeenCalledWith('a@b.c', 'p');
  });

  it('throws UnauthorizedException when invalid', async () => {
    mockAuth.validateUser.mockResolvedValue(null);
    await expect(strategy.validate('a@b.c', 'bad')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
