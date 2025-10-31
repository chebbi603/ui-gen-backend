import { Test, TestingModule } from '@nestjs/testing';
import { GeminiController } from './gemini.controller';
import { QueueService } from '../queue.service';
import { UserService } from '../../user/services/user.service';
import { GeminiService } from '../../llm/services/gemini.service';
import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';

describe('GeminiController (unit)', () => {
  let controller: GeminiController;
  const mockQueue: any = {
    addGeminiGenerationJob: jest.fn(),
    getGeminiJobStatus: jest.fn(),
  };
  const mockUser: any = {
    findOne: jest.fn(),
  };
  const mockGemini: any = {
    isCircuitOpen: jest.fn(),
    resetCircuitBreaker: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GeminiController],
      providers: [
        { provide: QueueService, useValue: mockQueue },
        { provide: UserService, useValue: mockUser },
        { provide: GeminiService, useValue: mockGemini },
      ],
    }).compile();

    controller = module.get<GeminiController>(GeminiController);
  });

  describe('enqueueGeneration', () => {
    it('returns job id when user exists and circuit closed', async () => {
      mockUser.findOne.mockResolvedValue({ _id: 'u1' });
      mockGemini.isCircuitOpen.mockReturnValue(false);
      mockQueue.addGeminiGenerationJob.mockResolvedValue('job123');

      const res = await controller.enqueueGeneration({ userId: 'u1', priority: 2 } as any, {} as any);
      expect(res).toEqual({ jobId: 'job123', message: 'Accepted' });
      expect(mockQueue.addGeminiGenerationJob).toHaveBeenCalledWith({ userId: 'u1', priority: 2 });
    });

    it('throws 404 when user does not exist', async () => {
      mockUser.findOne.mockResolvedValue(null);
      await expect(controller.enqueueGeneration({ userId: 'missing' } as any, {} as any)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws 503 when circuit is open', async () => {
      mockUser.findOne.mockResolvedValue({ _id: 'u1' });
      mockGemini.isCircuitOpen.mockReturnValue(true);
      await expect(controller.enqueueGeneration({ userId: 'u1' } as any, {} as any)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('maps queue init error to 503', async () => {
      mockUser.findOne.mockResolvedValue({ _id: 'u1' });
      mockGemini.isCircuitOpen.mockReturnValue(false);
      mockQueue.addGeminiGenerationJob.mockRejectedValue(new Error('Queue not initialized'));
      await expect(controller.enqueueGeneration({ userId: 'u1' } as any, {} as any)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });

  describe('getJobStatus', () => {
    it('returns status when found', async () => {
      mockQueue.getGeminiJobStatus.mockResolvedValue({ id: 'id1', status: 'completed', progress: 100, timestamps: {} });
      const res = await controller.getJobStatus('id1');
      expect(res.id).toBe('id1');
      expect(res.status).toBe('completed');
    });

    it('throws 404 when not found', async () => {
      mockQueue.getGeminiJobStatus.mockResolvedValue(null);
      await expect(controller.getJobStatus('idX')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('resetCircuitBreaker', () => {
    it('calls reset and returns success', async () => {
      const res = await controller.resetCircuitBreaker();
      expect(mockGemini.resetCircuitBreaker).toHaveBeenCalled();
      expect(res).toEqual({ success: true });
    });
  });
});