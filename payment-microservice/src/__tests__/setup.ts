// Jest setup file for global test configuration
import 'reflect-metadata';

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.DATABASE_HOST = 'localhost';
process.env.DATABASE_PORT = '5432';
process.env.DATABASE_NAME = 'test_db';
process.env.DATABASE_USER = 'test';
process.env.DATABASE_PASSWORD = 'test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.ENCRYPTION_KEY = 'test-32-character-encryption-key-12345';
process.env.JWT_SECRET = 'test-32-character-jwt-secret-key-12345';
process.env.LOG_LEVEL = 'error';
process.env.PORT = '3000';

// Global test timeout
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock crypto module for consistent testing
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomBytes: jest.fn().mockImplementation((size: number) => {
    // Return different values for different calls to ensure uniqueness
    const timestamp = Date.now().toString();
    const padding = '0'.repeat(Math.max(0, size - timestamp.length));
    const data = (timestamp + padding).slice(0, size);
    return Buffer.from(data);
  }),
  randomUUID: jest.fn().mockImplementation(() => {
    // Generate unique UUIDs for each call
    return `test-uuid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }),
}));