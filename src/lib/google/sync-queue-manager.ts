/**
 * Google Ads Sync Queue Manager
 * 
 * Manages synchronization queue for multiple clients with prioritization and rate limiting
 * Requirements: 3.2, 10.1
 */

import { getGoogleSyncService, SyncOptions, SyncResult } from './sync-service';
import { GoogleAdsRepository } from '@/lib/repositories/google-ads-repository';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface SyncJob {
  id: string;
  clientId: string;
  connectionId: string;
  priority: 'high' | 'normal' | 'low';
  type: 'manual' | 'scheduled' | 'retry';
  options: SyncOptions;
  createdAt: Date;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface QueueStats {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  totalProcessed: number;
  averageProcessingTime: number;
}

export interface RateLimitConfig {
  maxConcurrent: number;
  requestsPerMinute: number;
  requestsPerHour: number;
  delayBetweenJobs: number;
}

export interface QueueConfig {
  maxConcurrentJobs: number;
  maxRetries: number;
  retryDelay: number;
  rateLimit: RateLimitConfig;
}

// ============================================================================
// Sync Queue Manager Class
// ============================================================================

export class SyncQueueManager {
  private syncService = getGoogleSyncService();
  private repository = new GoogleAdsRepository();
  
  // Queue storage
  private queue: SyncJob[] = [];
  private runningJobs: Map<string, SyncJob> = new Map();
  private completedJobs: Map<string, SyncResult> = new Map();
  private failedJobs: Map<string, SyncJob> = new Map();
  
  // Rate limiting
  private requestsInLastMinute: number[] = [];
  private requestsInLastHour: number[] = [];
  private lastJobTime: number = 0;
  
  // Configuration
  private config: QueueConfig = {
    maxConcurrentJobs: 3,
    maxRetries: 3,
    retryDelay: 5000, // 5 seconds
    rateLimit: {
      maxConcurrent: 3,
      requestsPerMinute: 30,
      requestsPerHour: 1000,
      delayBetweenJobs: 2000, // 2 seconds
    },
  };
  
  // Processing state
  private isProcessing: boolean = false;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<QueueConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  // ==========================================================================
  // Queue Management Methods
  // ==========================================================================

  /**
   * Add a sync job to the queue
   */
  async addJob(
    clientId: string,
    options: Partial<SyncOptions> = {},
    priority: 'high' | 'normal' | 'low' = 'normal',
    type: 'manual' | 'scheduled' | 'retry' = 'scheduled'
  ): Promise<string> {
    try {
      // Get connection for client
      const connection = await this.repository.getConnection(clientId);
      
      if (!connection) {
        throw new Error(`No active Google Ads connection found for client ${clientId}`);
      }

      // Create job
      const job: SyncJob = {
        id: this.generateJobId(),
        clientId,
        connectionId: connection.id,
        priority,
        type,
        options: {
          clientId,
          connectionId: connection.id,
          customerId: connection.customer_id,
          fullSync: options.fullSync ?? false,
          syncMetrics: options.syncMetrics ?? true,
          dateRange: options.dateRange,
        },
        createdAt: new Date(),
        attempts: 0,
        maxAttempts: this.config.maxRetries,
        status: 'pending',
      };

      // Check if job already exists for this client
      const existingJob = this.queue.find(
        j => j.clientId === clientId && j.status === 'pending'
      );

      if (existingJob) {
        console.log(`[Sync Queue] Job already exists for client ${clientId}, updating priority`);
        existingJob.priority = this.getHigherPriority(existingJob.priority, priority);
        return existingJob.id;
      }

      // Add to queue
      this.queue.push(job);
      
      // Sort queue by priority
      this.sortQueue();

      console.log(`[Sync Queue] Job added: ${job.id} (client: ${clientId}, priority: ${priority})`);

      // Start processing if not already running
      if (!this.isProcessing) {
        this.startProcessing();
      }

      return job.id;

    } catch (error) {
      console.error('[Sync Queue] Error adding job:', error);
      throw error;
    }
  }

  /**
   * Add multiple jobs in batch
   */
  async addBatchJobs(
    clientIds: string[],
    options: Partial<SyncOptions> = {},
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): Promise<string[]> {
    const jobIds: string[] = [];

    for (const clientId of clientIds) {
      try {
        const jobId = await this.addJob(clientId, options, priority, 'scheduled');
        jobIds.push(jobId);
      } catch (error) {
        console.error(`[Sync Queue] Error adding job for client ${clientId}:`, error);
      }
    }

    return jobIds;
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): {
    status: string;
    result?: SyncResult;
    error?: string;
  } {
    // Check running jobs
    const runningJob = this.runningJobs.get(jobId);
    if (runningJob) {
      return { status: 'running' };
    }

    // Check completed jobs
    const completedResult = this.completedJobs.get(jobId);
    if (completedResult) {
      return { status: 'completed', result: completedResult };
    }

    // Check failed jobs
    const failedJob = this.failedJobs.get(jobId);
    if (failedJob) {
      return { status: 'failed', error: failedJob.lastError };
    }

    // Check pending jobs
    const pendingJob = this.queue.find(j => j.id === jobId);
    if (pendingJob) {
      return { status: 'pending' };
    }

    return { status: 'not_found' };
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): QueueStats {
    const pending = this.queue.filter(j => j.status === 'pending').length;
    const running = this.runningJobs.size;
    const completed = this.completedJobs.size;
    const failed = this.failedJobs.size;

    return {
      pending,
      running,
      completed,
      failed,
      totalProcessed: completed + failed,
      averageProcessingTime: 0, // TODO: Calculate from completed jobs
    };
  }

  /**
   * Clear completed and failed jobs
   */
  clearHistory(): void {
    this.completedJobs.clear();
    this.failedJobs.clear();
    console.log('[Sync Queue] History cleared');
  }

  /**
   * Stop processing queue
   */
  stopProcessing(): void {
    this.isProcessing = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    console.log('[Sync Queue] Processing stopped');
  }

  // ==========================================================================
  // Queue Processing Methods
  // ==========================================================================

  /**
   * Start processing the queue
   */
  private startProcessing(): void {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    console.log('[Sync Queue] Processing started');

    // Process queue immediately
    this.processQueue();

    // Set up interval to process queue periodically
    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, 5000); // Check every 5 seconds
  }

  /**
   * Process jobs in the queue
   */
  private async processQueue(): Promise<void> {
    try {
      // Check if we can process more jobs
      if (this.runningJobs.size >= this.config.maxConcurrentJobs) {
        return;
      }

      // Check rate limits
      if (!this.canProcessJob()) {
        console.log('[Sync Queue] Rate limit reached, waiting...');
        return;
      }

      // Get next job from queue
      const job = this.getNextJob();
      
      if (!job) {
        // No jobs to process
        if (this.runningJobs.size === 0 && this.queue.length === 0) {
          // Queue is empty and no jobs running, stop processing
          this.stopProcessing();
        }
        return;
      }

      // Process the job
      await this.processJob(job);

    } catch (error) {
      console.error('[Sync Queue] Error processing queue:', error);
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: SyncJob): Promise<void> {
    try {
      // Mark job as running
      job.status = 'running';
      job.attempts++;
      this.runningJobs.set(job.id, job);

      console.log(`[Sync Queue] Processing job ${job.id} (attempt ${job.attempts}/${job.maxAttempts})`);

      // Update rate limit tracking
      this.trackRequest();

      // Execute sync
      const result = await this.syncService.syncCampaigns(job.options);

      // Mark job as completed
      job.status = 'completed';
      this.runningJobs.delete(job.id);
      this.completedJobs.set(job.id, result);

      console.log(`[Sync Queue] Job ${job.id} completed successfully`);

      // Process next job after delay
      await this.delay(this.config.rateLimit.delayBetweenJobs);
      this.processQueue();

    } catch (error) {
      console.error(`[Sync Queue] Job ${job.id} failed:`, error);

      // Handle job failure
      await this.handleJobFailure(job, error);
    }
  }

  /**
   * Handle job failure with retry logic
   */
  private async handleJobFailure(job: SyncJob, error: any): Promise<void> {
    job.lastError = error instanceof Error ? error.message : 'Unknown error';
    this.runningJobs.delete(job.id);

    // Check if we should retry
    if (job.attempts < job.maxAttempts && this.isRetryableError(error)) {
      console.log(`[Sync Queue] Retrying job ${job.id} (attempt ${job.attempts + 1}/${job.maxAttempts})`);
      
      // Reset status and add back to queue
      job.status = 'pending';
      job.type = 'retry';
      job.priority = 'high'; // Increase priority for retries
      
      this.queue.push(job);
      this.sortQueue();

      // Wait before processing next job
      await this.delay(this.config.retryDelay);
      this.processQueue();

    } else {
      // Max retries reached or non-retryable error
      console.error(`[Sync Queue] Job ${job.id} failed permanently after ${job.attempts} attempts`);
      
      job.status = 'failed';
      this.failedJobs.set(job.id, job);

      // Process next job
      this.processQueue();
    }
  }

  /**
   * Get next job from queue based on priority
   */
  private getNextJob(): SyncJob | null {
    // Remove job from queue
    const job = this.queue.shift();
    return job || null;
  }

  /**
   * Sort queue by priority (high > normal > low) and creation time
   */
  private sortQueue(): void {
    const priorityOrder = { high: 0, normal: 1, low: 2 };

    this.queue.sort((a, b) => {
      // First sort by priority
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      // Then by creation time (older first)
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  // ==========================================================================
  // Rate Limiting Methods
  // ==========================================================================

  /**
   * Check if we can process a job based on rate limits
   */
  private canProcessJob(): boolean {
    const now = Date.now();

    // Check concurrent jobs limit
    if (this.runningJobs.size >= this.config.rateLimit.maxConcurrent) {
      return false;
    }

    // Check delay between jobs
    if (now - this.lastJobTime < this.config.rateLimit.delayBetweenJobs) {
      return false;
    }

    // Clean up old request timestamps
    this.cleanupRateLimitTracking();

    // Check requests per minute
    if (this.requestsInLastMinute.length >= this.config.rateLimit.requestsPerMinute) {
      return false;
    }

    // Check requests per hour
    if (this.requestsInLastHour.length >= this.config.rateLimit.requestsPerHour) {
      return false;
    }

    return true;
  }

  /**
   * Track a request for rate limiting
   */
  private trackRequest(): void {
    const now = Date.now();
    this.lastJobTime = now;
    this.requestsInLastMinute.push(now);
    this.requestsInLastHour.push(now);
  }

  /**
   * Clean up old request timestamps
   */
  private cleanupRateLimitTracking(): void {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;

    // Remove requests older than 1 minute
    this.requestsInLastMinute = this.requestsInLastMinute.filter(
      time => time > oneMinuteAgo
    );

    // Remove requests older than 1 hour
    this.requestsInLastHour = this.requestsInLastHour.filter(
      time => time > oneHourAgo
    );
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get higher priority between two priorities
   */
  private getHigherPriority(
    p1: 'high' | 'normal' | 'low',
    p2: 'high' | 'normal' | 'low'
  ): 'high' | 'normal' | 'low' {
    const priorityOrder = { high: 0, normal: 1, low: 2 };
    return priorityOrder[p1] < priorityOrder[p2] ? p1 : p2;
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (!error) return false;

    const errorMessage = error.message?.toLowerCase() || '';
    const errorCode = error.code?.toLowerCase() || '';

    // Rate limit errors
    if (
      errorCode.includes('rate_limit') ||
      errorCode.includes('quota_exceeded') ||
      errorMessage.includes('rate limit') ||
      errorMessage.includes('quota exceeded')
    ) {
      return true;
    }

    // Temporary network errors
    if (
      errorCode.includes('econnreset') ||
      errorCode.includes('etimedout') ||
      errorCode.includes('enotfound') ||
      errorMessage.includes('network') ||
      errorMessage.includes('timeout')
    ) {
      return true;
    }

    // Server errors (5xx)
    if (error.status >= 500 && error.status < 600) {
      return true;
    }

    return false;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current queue state (for debugging)
   */
  getQueueState(): {
    pending: SyncJob[];
    running: SyncJob[];
    completed: number;
    failed: number;
  } {
    return {
      pending: this.queue,
      running: Array.from(this.runningJobs.values()),
      completed: this.completedJobs.size,
      failed: this.failedJobs.size,
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let queueManagerInstance: SyncQueueManager | null = null;

/**
 * Get singleton instance of SyncQueueManager
 */
export function getSyncQueueManager(): SyncQueueManager {
  if (!queueManagerInstance) {
    queueManagerInstance = new SyncQueueManager();
  }
  return queueManagerInstance;
}
