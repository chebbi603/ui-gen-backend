// Mock jsonwebtoken to avoid import-time errors in e2e when auth is not under test
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'mock-token'),
  verify: jest.fn(() => ({ userId: 'mock-user' })),
  decode: jest.fn(() => ({ header: {}, payload: {} })),
}));

// Optionally silence ioredis if Redis is not configured during e2e
jest.mock('ioredis', () => {
  return class MockRedis {
    constructor() {}
    get() { return Promise.resolve(null); }
    set() { return Promise.resolve('OK'); }
    quit() { return Promise.resolve(); }
  };
});