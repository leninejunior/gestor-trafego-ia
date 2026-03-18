/**
 * Google Ads Logging and Monitoring Tests
 * 
 * Tests the logging and monitoring system functionality
 * Requirements: 10.3, 10.5
 */

import { googleAdsLogger } from '../logger';
import { googleAdsPerformanceMonitor } from '../performance-monitor';

// Mock console methods
const mockConsole = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock Supabase
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          gte: jest.fn(() => ({
            lte: jest.fn(() => Promise.resolve({ data: [], error: null }))
          }))
        }))
      }))
    }))
  }))
}));

describe('Google Ads Logger', () => {
  beforeEach(() => {
    // Replace console methods with mocks
    Object.assign(console, mockConsole);
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original console methods
    jest.restoreAllMocks();
  });

  test('should log info messages with context', () => {
    const context = { clientId: 'test-client', operation: 'test' };
    
    googleAdsLogger.info('Test message', context);
    
    expect(mockConsole.info).toHaveBeenCalledWith(
      expect.stringContaining('[GoogleAds] Test message')
    );
  });

  test('should log error messages with error object', () => {
    const error = new Error('Test error');
    const context = { clientId: 'test-client' };
    
    googleAdsLogger.error('Operation failed', error, context);
    
    expect(mockConsole.error).toHaveBeenCalledWith(
      expect.stringContaining('[GoogleAds] Operation failed')
    );
  });

  test('should generate request ID for API requests', () => {
    const requestId = googleAdsLogger.apiRequestStart('GET', '/campaigns');
    
    expect(requestId).toMatch(/^gads_\d+_[a-z0-9]+$/);
    expect(mockConsole.info).toHaveBeenCalledWith(
      expect.stringContaining('API Request Started')
    );
  });

  test('should log API request completion', () => {
    const requestId = 'test-request-id';
    
    googleAdsLogger.apiRequestComplete(requestId, 200, 1500);
    
    expect(mockConsole.info).toHaveBeenCalledWith(
      expect.stringContaining('API Request Completed: 200')
    );
  });

  test('should log sync operations', () => {
    const requestId = googleAdsLogger.syncStart('campaigns');
    
    expect(requestId).toMatch(/^gads_\d+_[a-z0-9]+$/);
    expect(mockConsole.info).toHaveBeenCalledWith(
      expect.stringContaining('Sync Started: campaigns')
    );

    googleAdsLogger.syncComplete(requestId, {
      success: true,
      campaignsSynced: 10,
      metricsUpdated: 50,
      errors: 0
    }, 5000);

    expect(mockConsole.info).toHaveBeenCalledWith(
      expect.stringContaining('Sync Completed: Success')
    );
  });

  test('should log authentication events', () => {
    googleAdsLogger.authEvent('token_refresh', { connectionId: 'conn-123' });
    
    expect(mockConsole.info).toHaveBeenCalledWith(
      expect.stringContaining('Access token refreshed successfully')
    );
  });

  test('should log performance metrics', () => {
    googleAdsLogger.performance('sync_campaigns', {
      duration: 5000,
      recordsProcessed: 100,
      apiCalls: 10
    });
    
    expect(mockConsole.info).toHaveBeenCalledWith(
      expect.stringContaining('Performance: sync_campaigns')
    );
  });

  test('should log rate limiting events', () => {
    googleAdsLogger.rateLimitEvent('limit_hit', {
      retryAfter: 60,
      attemptNumber: 1,
      maxRetries: 3
    });
    
    expect(mockConsole.warn).toHaveBeenCalledWith(
      expect.stringContaining('Rate Limit: limit_hit')
    );
  });
});

describe('Google Ads Performance Monitor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should start and track operations', () => {
    const operationId = googleAdsPerformanceMonitor.startOperation(
      'test-op-1',
      'test_operation',
      { clientId: 'test-client' }
    );

    expect(operationId).toBe('test-op-1');

    const status = googleAdsPerformanceMonitor.getOperationStatus(operationId);
    expect(status).toBeTruthy();
    expect(status?.operation).toBe('test_operation');
    expect(status?.recordsProcessed).toBe(0);
  });

  test('should update operation metrics', () => {
    const operationId = googleAdsPerformanceMonitor.startOperation(
      'test-op-2',
      'test_operation'
    );

    googleAdsPerformanceMonitor.updateOperation(operationId, {
      recordsProcessed: 50,
      apiCalls: 5,
      errors: 1
    });

    const status = googleAdsPerformanceMonitor.getOperationStatus(operationId);
    expect(status?.recordsProcessed).toBe(50);
    expect(status?.apiCalls).toBe(5);
    expect(status?.errors).toBe(1);
  });

  test('should finish operations and calculate metrics', async () => {
    const operationId = googleAdsPerformanceMonitor.startOperation(
      'test-op-3',
      'test_operation'
    );

    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 10));

    googleAdsPerformanceMonitor.updateOperation(operationId, {
      recordsProcessed: 100,
      apiCalls: 10
    });

    const result = await googleAdsPerformanceMonitor.finishOperation(operationId, {
      clientId: 'test-client'
    });

    expect(result).toBeTruthy();
    expect(result?.operation).toBe('test_operation');
    expect(result?.recordsProcessed).toBe(100);
    expect(result?.apiCalls).toBe(10);
    expect(result?.duration).toBeGreaterThan(0);
  });

  test('should track active operations', () => {
    // Clear any existing operations first
    const existingOps = googleAdsPerformanceMonitor.getActiveOperations();
    for (const [id] of existingOps) {
      googleAdsPerformanceMonitor.finishOperation(id);
    }

    const operationId1 = googleAdsPerformanceMonitor.startOperation(
      'test-op-4',
      'operation_1'
    );
    const operationId2 = googleAdsPerformanceMonitor.startOperation(
      'test-op-5',
      'operation_2'
    );

    const activeOps = googleAdsPerformanceMonitor.getActiveOperations();
    expect(activeOps.size).toBe(2);
    expect(activeOps.has(operationId1)).toBe(true);
    expect(activeOps.has(operationId2)).toBe(true);
  });

  test('should generate unique operation IDs', () => {
    const { GoogleAdsPerformanceMonitor } = require('../performance-monitor');
    
    const id1 = GoogleAdsPerformanceMonitor.generateOperationId('test');
    const id2 = GoogleAdsPerformanceMonitor.generateOperationId('test');

    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^test_\d+_[a-z0-9]+$/);
    expect(id2).toMatch(/^test_\d+_[a-z0-9]+$/);
  });

  test('should return null for non-existent operations', () => {
    const status = googleAdsPerformanceMonitor.getOperationStatus('non-existent');
    expect(status).toBeNull();

    const result = googleAdsPerformanceMonitor.finishOperation('non-existent');
    expect(result).resolves.toBeNull();
  });
});

describe('Integration Tests', () => {
  test('should integrate logger with performance monitor', async () => {
    const operationId = googleAdsPerformanceMonitor.startOperation(
      'integration-test',
      'test_integration'
    );

    // Log some operations
    googleAdsLogger.info('Starting integration test', {
      operation: 'test_integration',
      requestId: operationId
    });

    googleAdsPerformanceMonitor.updateOperation(operationId, {
      recordsProcessed: 25,
      apiCalls: 3
    });

    googleAdsLogger.performance('test_integration', {
      duration: 1000,
      recordsProcessed: 25,
      apiCalls: 3
    });

    const result = await googleAdsPerformanceMonitor.finishOperation(operationId);

    expect(result).toBeTruthy();
    expect(result?.recordsProcessed).toBe(25);
    expect(result?.apiCalls).toBe(3);

    // Verify logging occurred
    expect(mockConsole.info).toHaveBeenCalledWith(
      expect.stringContaining('Starting integration test')
    );
    expect(mockConsole.info).toHaveBeenCalledWith(
      expect.stringContaining('Performance: test_integration')
    );
  });
});