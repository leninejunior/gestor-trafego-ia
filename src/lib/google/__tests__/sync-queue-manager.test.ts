/**
 * Sync Queue Manager Tests
 * 
 * Tests for Google Ads Sync Queue Manager functionality
 * Requirements: 3.2, 10.1
 */

import { SyncQueueManager } from '../sync-queue-manager';

// Mock dependencies
jest.mock('../sync-service');
jest.mock('@/lib/repositories/google-ads-repository');

describe('SyncQueueManager', () => {
  let queueManager: SyncQueueManager;

  beforeEach(() => {
    queueManager = new SyncQueueManager({
      maxConcurrentJobs: 2,
      maxRetries: 3,
      retryDelay: 1000,
      rateLimit: {
        maxConcurrent: 2,
        requestsPerMinute: 10,
        requestsPerHour: 100,
        delayBetweenJobs: 500,
      },
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    queueManager.stopProcessing();
  });

  describe('Job ID Generation', () => {
    it('should generate unique job IDs', () => {
      const generateJobId = (queueManager as any).generateJobId.bind(queueManager);

      const id1 = generateJobId();
      const id2 = generateJobId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^sync_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^sync_\d+_[a-z0-9]+$/);
    });
  });

  describe('Priority Comparison', () => {
    it('should correctly identify higher priority', () => {
      const getHigherPriority = (queueManager as any).getHigherPriority.bind(queueManager);

      expect(getHigherPriority('high', 'normal')).toBe('high');
      expect(getHigherPriority('normal', 'low')).toBe('normal');
      expect(getHigherPriority('high', 'low')).toBe('high');
      expect(getHigherPriority('normal', 'normal')).toBe('normal');
    });
  });

  describe('Error Classification', () => {
    it('should identify retryable rate limit errors', () => {
      const isRetryable = (queueManager as any).isRetryableError.bind(queueManager);

      const rateLimitError = {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded',
      };

      expect(isRetryable(rateLimitError)).toBe(true);
    });

    it('should identify retryable network errors', () => {
      const isRetryable = (queueManager as any).isRetryableError.bind(queueManager);

      const networkError = {
        code: 'ECONNRESET',
        message: 'Connection reset',
      };

      expect(isRetryable(networkError)).toBe(true);
    });

    it('should not retry authentication errors', () => {
      const isRetryable = (queueManager as any).isRetryableError.bind(queueManager);

      const authError = {
        code: 'AUTH_ERROR',
        message: 'Authentication failed',
      };

      expect(isRetryable(authError)).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    it('should track requests correctly', () => {
      const trackRequest = (queueManager as any).trackRequest.bind(queueManager);

      trackRequest();
      trackRequest();

      const requestsInLastMinute = (queueManager as any).requestsInLastMinute;
      expect(requestsInLastMinute.length).toBe(2);
    });

    it('should clean up old request timestamps', () => {
      const trackRequest = (queueManager as any).trackRequest.bind(queueManager);
      const cleanupRateLimitTracking = (queueManager as any).cleanupRateLimitTracking.bind(queueManager);

      // Add old requests
      const requestsInLastMinute = (queueManager as any).requestsInLastMinute;
      const requestsInLastHour = (queueManager as any).requestsInLastHour;

      const oldTime = Date.now() - 2 * 60 * 1000; // 2 minutes ago
      requestsInLastMinute.push(oldTime);
      requestsInLastHour.push(oldTime);

      // Add recent request
      trackRequest();

      // Cleanup
      cleanupRateLimitTracking();

      // Old minute request should be removed
      expect(requestsInLastMinute.length).toBe(1);
      // Old hour request should still be there
      expect(requestsInLastHour.length).toBe(2);
    });

    it('should respect concurrent job limit', () => {
      const canProcessJob = (queueManager as any).canProcessJob.bind(queueManager);

      // Add running jobs up to limit
      const runningJobs = (queueManager as any).runningJobs;
      runningJobs.set('job1', { id: 'job1' });
      runningJobs.set('job2', { id: 'job2' });

      // Should not be able to process more jobs
      expect(canProcessJob()).toBe(false);
    });

    it('should respect delay between jobs', () => {
      const canProcessJob = (queueManager as any).canProcessJob.bind(queueManager);

      // Set last job time to now
      (queueManager as any).lastJobTime = Date.now();

      // Should not be able to process immediately
      expect(canProcessJob()).toBe(false);
    });
  });

  describe('Queue Statistics', () => {
    it('should return correct queue stats', () => {
      const stats = queueManager.getQueueStats();

      expect(stats).toHaveProperty('pending');
      expect(stats).toHaveProperty('running');
      expect(stats).toHaveProperty('completed');
      expect(stats).toHaveProperty('failed');
      expect(stats).toHaveProperty('totalProcessed');
      expect(stats).toHaveProperty('averageProcessingTime');

      expect(typeof stats.pending).toBe('number');
      expect(typeof stats.running).toBe('number');
      expect(typeof stats.completed).toBe('number');
      expect(typeof stats.failed).toBe('number');
    });
  });

  describe('Queue State', () => {
    it('should return current queue state', () => {
      const state = queueManager.getQueueState();

      expect(state).toHaveProperty('pending');
      expect(state).toHaveProperty('running');
      expect(state).toHaveProperty('completed');
      expect(state).toHaveProperty('failed');

      expect(Array.isArray(state.pending)).toBe(true);
      expect(Array.isArray(state.running)).toBe(true);
      expect(typeof state.completed).toBe('number');
      expect(typeof state.failed).toBe('number');
    });
  });

  describe('Job Addition', () => {
    it('should handle missing connection gracefully', async () => {
      const mockRepository = require('@/lib/repositories/google-ads-repository').GoogleAdsRepository;
      mockRepository.prototype.getConnection = jest.fn().mockResolvedValue(null);

      await expect(
        queueManager.addJob('client-123')
      ).rejects.toThrow('No active Google Ads connection found');
    });
  });

  describe('Delay Helper', () => {
    it('should delay execution', async () => {
      const delay = (queueManager as any).delay.bind(queueManager);
      const startTime = Date.now();

      await delay(100);

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(90);
      expect(elapsed).toBeLessThan(200);
    });
  });
});
