import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
// Stub passport-jwt to avoid loading jsonwebtoken/jwa in tests
jest.mock('passport-jwt', () => ({
  Strategy: class Strategy {
    name = 'jwt';
    constructor(..._args: any[]) {}
  },
  ExtractJwt: {
    fromAuthHeaderAsBearerToken: () => () => undefined,
  },
}));

describe('JwtStrategy', () => {
  it('validates payload and returns user info', async () => {
    const strategy = new JwtStrategy({
      get: () => 'secret',
    } as unknown as ConfigService);
    const payload = { sub: 'u1', email: 'a@b.c', role: 'ADMIN' };
    const res = await strategy.validate(payload);
    expect(res).toEqual({ userId: 'u1', email: 'a@b.c', role: 'ADMIN' });
  });
});
