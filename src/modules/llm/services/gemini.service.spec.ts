import { Test, TestingModule } from '@nestjs/testing';
import { GeminiService } from './gemini.service';
import { ConfigService } from '@nestjs/config';
import { ContractService } from '../../contract/services/contract.service';
import { EventService } from '../../event/services/event.service';
import { SessionService } from '../../session/services/session.service';
import { GeminiClient } from '../clients/gemini.client';

describe('GeminiService (circuit breaker)', () => {
  let service: GeminiService;

  const mockConfig: any = { get: jest.fn() };
  const mockContract: any = {};
  const mockEvent: any = {};
  const mockSession: any = {};
  const mockClient: any = { isEnabled: jest.fn().mockReturnValue(true) };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeminiService,
        { provide: ConfigService, useValue: mockConfig },
        { provide: ContractService, useValue: mockContract },
        { provide: EventService, useValue: mockEvent },
        { provide: SessionService, useValue: mockSession },
        { provide: GeminiClient, useValue: mockClient },
      ],
    }).compile();

    service = module.get<GeminiService>(GeminiService);
  });

  it('resetCircuitBreaker clears failures and openUntil', () => {
    // Simulate open circuit
    (service as any).failures = 2;
    (service as any).openUntil = Date.now() + 60000;

    expect(service.isCircuitOpen()).toBe(true);
    service.resetCircuitBreaker();
    expect(service.isCircuitOpen()).toBe(false);
    expect((service as any).failures).toBe(0);
    expect((service as any).openUntil).toBe(0);
  });

  it('isCircuitOpen auto-resets when cooldown elapsed', () => {
    (service as any).openUntil = Date.now() - 1000; // already expired
    // First call should reset state and return false
    expect(service.isCircuitOpen()).toBe(false);
    expect((service as any).openUntil).toBe(0);
    expect((service as any).failures).toBe(0);
  });

  it('recordFailure opens circuit after threshold', () => {
    // threshold is 3; call recordFailure 3 times
    (service as any).failures = 0;
    (service as any).openUntil = 0;
    (service as any).recordFailure();
    expect(service.isCircuitOpen()).toBe(false);
    (service as any).recordFailure();
    expect(service.isCircuitOpen()).toBe(false);
    (service as any).recordFailure();
    // After third failure, circuit should be open
    expect(service.isCircuitOpen()).toBe(true);
    expect((service as any).openUntil).toBeGreaterThan(Date.now());
  });
});