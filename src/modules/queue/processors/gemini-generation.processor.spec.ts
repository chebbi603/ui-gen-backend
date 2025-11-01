import { Test, TestingModule } from '@nestjs/testing';
import { GeminiGenerationProcessor } from './gemini-generation.processor';
import { LlmService } from '../../llm/services/llm.service';
import { ContractService } from '../../contract/services/contract.service';
import { UserContractService } from '../../user-contract/services/user-contract.service';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { LlmJob } from '../../llm/entities/llm-job.entity';
import { ContractValidationService } from '../../contract/services/contract-validation.service';

describe('GeminiGenerationProcessor (unit)', () => {
  let processor: GeminiGenerationProcessor;

  const mockLlmService: any = { generateOptimizedContract: jest.fn() };
  const mockContractService: any = { create: jest.fn() };
  const mockUserContractService: any = { upsertUserContract: jest.fn() };
  const mockConfig: any = { get: jest.fn().mockReturnValue('unit-model') };
  const mockValidation: any = { validate: jest.fn().mockReturnValue({ isValid: true, errors: [] }) };

  // Mock Mongoose Model constructor and static updateOne
  const mockModelCtor: any = jest.fn().mockImplementation((doc) => ({
    ...doc,
    save: jest.fn().mockResolvedValue(undefined),
  }));
  mockModelCtor.updateOne = jest.fn().mockResolvedValue({});

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeminiGenerationProcessor,
        { provide: LlmService, useValue: mockLlmService },
        { provide: ContractService, useValue: mockContractService },
        { provide: UserContractService, useValue: mockUserContractService },
        { provide: ContractValidationService, useValue: mockValidation },
        { provide: ConfigService, useValue: mockConfig },
        { provide: getModelToken(LlmJob.name), useValue: mockModelCtor },
      ],
    }).compile();

    processor = module.get<GeminiGenerationProcessor>(GeminiGenerationProcessor);
  });

  it('process validation failure after LLM returns JSON leads to discard', async () => {
    const job = makeJob();
    mockLlmService.generateOptimizedContract.mockResolvedValue({ json: { bad: true }, version: '0.1.1' });
    mockValidation.validate.mockReturnValue({ isValid: false, errors: [{ path: 'pagesUI', message: 'Required section missing' }] });

    await expect(processor.process(job as any)).rejects.toThrow(/Validation error: /);
    expect(job.discard).toHaveBeenCalled();
    expect(mockModelCtor.updateOne).toHaveBeenCalledWith(
      { jobId: 'jid-1' },
      expect.objectContaining({ $set: expect.objectContaining({ status: 'failed', errorMessage: expect.stringContaining('Validation error:') }) }),
    );
  });

  const makeJob = (overrides: Partial<any> = {}) => ({
    id: 'jid-1',
    data: { userId: '507f1f77bcf86cd799439011', baseContract: { a: 1 }, version: '0.1.0' },
    updateProgress: jest.fn().mockResolvedValue(undefined),
    discard: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  });

  it('process success path updates job, creates contract, and returns ids', async () => {
    const job = makeJob();
    mockValidation.validate.mockReturnValue({ isValid: true, errors: [] });
    const validJson = { meta: {}, pagesUI: { pages: {} } };
    mockLlmService.generateOptimizedContract.mockResolvedValue({ json: validJson, version: '0.1.1' });
    mockContractService.create.mockResolvedValue({ _id: 'c123', version: '0.1.1', json: validJson, meta: { optimizationExplanation: 'x' }, analytics: { kpi: 1 } });
    mockUserContractService.upsertUserContract.mockResolvedValue({ ok: 1 });

    const res = await processor.process(job as any);
    expect(res).toEqual({ contractId: 'c123', version: '0.1.1' });

    // Validation invoked on returned JSON
    expect(mockValidation.validate).toHaveBeenCalledWith(validJson);

    // LlmJob created and saved
    expect(mockModelCtor).toHaveBeenCalledWith(expect.objectContaining({ jobId: 'jid-1', status: 'processing', progress: 0, model: 'unit-model' }));
    const instance = mockModelCtor.mock.results[0]?.value;
    expect(instance.save).toHaveBeenCalled();

    // Progress updates
    expect(job.updateProgress).toHaveBeenCalledTimes(4);
    expect(job.updateProgress).toHaveBeenNthCalledWith(1, 25);
    expect(job.updateProgress).toHaveBeenNthCalledWith(2, 50);
    expect(job.updateProgress).toHaveBeenNthCalledWith(3, 75);
    expect(job.updateProgress).toHaveBeenNthCalledWith(4, 100);

    // Completed status update
    expect(mockModelCtor.updateOne).toHaveBeenCalledWith(
      { jobId: 'jid-1' },
      expect.objectContaining({ $set: expect.objectContaining({ status: 'completed', progress: 100, contractId: 'c123' }) }),
    );
  });

  it('process retryable failure updates job failed and does not discard', async () => {
    const job = makeJob();
    mockLlmService.generateOptimizedContract.mockRejectedValue(new Error('Network timeout occurred'));

    await expect(processor.process(job as any)).rejects.toThrow('Network timeout occurred');

    // Progress updated only at start
    expect(job.updateProgress).toHaveBeenCalledTimes(1);
    expect(job.updateProgress).toHaveBeenCalledWith(25);

    // Failed status update
    expect(mockModelCtor.updateOne).toHaveBeenCalledWith(
      { jobId: 'jid-1' },
      expect.objectContaining({ $set: expect.objectContaining({ status: 'failed', errorMessage: expect.stringContaining('timeout') }) }),
    );

    // Retryable => no discard
    expect(job.discard).not.toHaveBeenCalled();
  });

  it('process non-retryable failure updates job failed and discards', async () => {
    const job = makeJob();
    mockLlmService.generateOptimizedContract.mockRejectedValue(new Error('Validation error: invalid schema'));

    await expect(processor.process(job as any)).rejects.toThrow('Validation error: invalid schema');

    expect(mockModelCtor.updateOne).toHaveBeenCalledWith(
      { jobId: 'jid-1' },
      expect.objectContaining({ $set: expect.objectContaining({ status: 'failed', errorMessage: expect.stringContaining('Validation error') }) }),
    );
    expect(job.discard).toHaveBeenCalled();
  });
});