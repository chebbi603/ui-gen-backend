import { Test, TestingModule } from '@nestjs/testing';
import { QueueService } from './queue.service';
import { ConfigService } from '@nestjs/config';
import { GeminiGenerationProcessor } from './processors/gemini-generation.processor';
import { AnalyzeEventsProcessor } from './processors/analyze-events.processor';

describe('QueueService (unit)', () => {
  let service: QueueService;
  const mockConfig: any = { get: jest.fn() };
  const mockProcessor: any = { process: jest.fn() };
  const mockAnalyze: any = { process: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        { provide: ConfigService, useValue: mockConfig },
        { provide: GeminiGenerationProcessor, useValue: mockProcessor },
        { provide: AnalyzeEventsProcessor, useValue: mockAnalyze },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);
  });

  describe('addGeminiGenerationJob', () => {
    it('throws when queue is not initialized', async () => {
      // Ensure queue undefined
      (service as any).queue = undefined;
      await expect(
        service.addGeminiGenerationJob({ userId: 'u1', priority: 2 } as any),
      ).rejects.toThrow('Queue not initialized');
    });

    it('adds job and returns id, respecting priority', async () => {
      const add = jest.fn().mockResolvedValue({ id: 'jid-1' });
      (service as any).queue = { add };
      const id = await service.addGeminiGenerationJob(
        { userId: 'u1', baseContract: {}, priority: 3 } as any,
        { attempts: 1, priority: 1 } as any,
      );
      expect(id).toBe('jid-1');
      expect(add).toHaveBeenCalled();
      const opts = add.mock.calls[0][2];
      expect(opts.priority).toBe(1); // options override data.priority
    });
  });

  describe('getGeminiJobStatus', () => {
    it('returns null when queue not initialized', async () => {
      (service as any).queue = undefined;
      const res = await service.getGeminiJobStatus('jid');
      expect(res).toBeNull();
    });

    it('maps job state to status and returns details', async () => {
      const job: any = {
        id: 'jid',
        getState: jest.fn().mockResolvedValue('completed'),
        timestamp: Date.now(),
        progress: 100,
        returnvalue: { ok: true },
        failedReason: null,
        processedOn: Date.now() - 100,
        finishedOn: Date.now(),
      };
      const getJob = jest.fn().mockResolvedValue(job);
      (service as any).queue = { getJob };

      const res = await service.getGeminiJobStatus('jid');
      expect(res).toBeDefined();
      expect(res!.id).toBe('jid');
      expect(res!.status).toBe('completed');
      expect(res!.progress).toBe(100);
      expect(res!.result).toEqual({ ok: true });
      expect(res!.timestamps.completedAt).toBeDefined();
    });
  });
});