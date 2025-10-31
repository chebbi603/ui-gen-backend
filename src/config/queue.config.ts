import { registerAs } from '@nestjs/config';

export default registerAs('queue', (): Record<string, any> => {
  return {
    gemini: {
      attempts: parseInt(process.env.QUEUE_GEMINI_ATTEMPTS || '3', 10),
      backoffMs: parseInt(process.env.QUEUE_GEMINI_BACKOFF_MS || '5000', 10),
      timeoutMs: parseInt(process.env.QUEUE_GEMINI_TIMEOUT_MS || '60000', 10),
    },
    cleanup: {
      completedMs: parseInt(
        process.env.QUEUE_CLEANUP_COMPLETED_MS || '604800000',
        10,
      ),
      failedMs: parseInt(
        process.env.QUEUE_CLEANUP_FAILED_MS || '604800000',
        10,
      ),
    },
    addTestJob: (process.env.QUEUE_ADD_TEST_JOB || 'false').toLowerCase() === 'true',
  };
});