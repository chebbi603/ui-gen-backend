import { RoleGuard } from './role-auth.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';

describe('RoleGuard', () => {
  const reflector = { get: jest.fn() } as unknown as Reflector;
  const guard = new RoleGuard(reflector);

  const makeContext = (userRole: string): ExecutionContext => ({
    switchToHttp: () => ({ getRequest: () => ({ user: { role: userRole } }) } as any),
    getHandler: () => ({} as any),
  } as any);

  beforeEach(() => {
    (reflector.get as any).mockReset();
  });

  it('allows when no roles metadata', () => {
    (reflector.get as any).mockReturnValue(undefined);
    expect(guard.canActivate(makeContext('USER'))).toBe(true);
  });

  it('denies when role mismatch', () => {
    (reflector.get as any).mockReturnValue(['ADMIN']);
    expect(guard.canActivate(makeContext('USER'))).toBe(false);
  });

  it('allows when role matches', () => {
    (reflector.get as any).mockReturnValue(['ADMIN']);
    expect(guard.canActivate(makeContext('ADMIN'))).toBe(true);
  });
});