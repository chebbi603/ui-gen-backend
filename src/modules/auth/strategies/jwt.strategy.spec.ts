import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  it('validates payload and returns user info', async () => {
    const strategy = new JwtStrategy({ get: () => 'secret' } as unknown as ConfigService);
    const payload = { sub: 'u1', email: 'a@b.c', role: 'ADMIN' };
    const res = await strategy.validate(payload);
    expect(res).toEqual({ userId: 'u1', email: 'a@b.c', role: 'ADMIN' });
  });
});