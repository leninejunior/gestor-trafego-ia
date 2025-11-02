/**
 * Sync Queue System
 * Manages prioritized queue of sync jobs with retry logic and concurrency control
 * Requirements: 4.5, 9.1, 9.2
 */

import { AdPlatform, SyncResult } from '@/lib/types/sync';
import { MultiPlatformSyncEngine, SyncJob } from './multi-platform-sync-engine';

/**
 * Queue item with retry tracking
 */
interface QueueItem extends SyncJob {
  attempts: number;
  last_attempt_at?: Date;
  last_error?: string;
  backoff_until?: Date;
}

/**
 * Queue statistics
 */
export interface QueueStats {
  total_jobs: number;
  pending_jobs: number;
  running_jobs: number;
  failed_jobs: number;
  completed_jobs: number;
  average_duration_ms: number;
}

/**
 * Sync Queue Configuration
 */
export interface SyncQueueConfig {
  maxConcurrency: number;
  maxRetries: number;
  initialBackoffMs: number;
  maxBackoffMs: number;
  backoffMultiplier: number;
}

/**
 * Default queue configuration
 */
const DEFAULT_CONFIG: SyncQueueConfig = {
  maxConcurrency: 3, // Process 3 syncs concurrently
  maxRetries: 3, // Retry failed syncs up to 3 times
  initialBackoffMs: 1000, // Start with 1 second backoff
  maxBackoffMs: 300000, // Max 5 minutes backoff
  backoffMultiplier: 2 // Double backoff each retry
};

/**
 * Sync Queue
 * Manages a priority queue of sync jobs with retry logic
 */
export class SyncQueue {
  private queue: QueueItem[] = [];
  private running: Map<string, QueueItem> = new Map();
  private completed: Map<string, SyncResult> = new Map();
  private failed: Map<string, QueueItem> = new Map();
  private config: SyncQueueConfig;
  private syncEngine: MultiPlatformSyncEngine;
  private isProcessing = false;

  constructor(
    syncEngine: MultiPlatformSyncEngine,
    config: Partial<SyncQueueConfig> = {}
  ) {
    this.syncEngine = syncEngine;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Add a job to the queue
   * @param job Sync job to add
   */
  addJob(job: SyncJob): void {
    const queueItem: QueueItem = {
      ...job,
      attempts: 0
    };

    // Check if job already exists in queue
    const existingIndex = this.queue.findIndex(
      item =>
        item.client_id === job.client_id && item.platform === job.platform
    );

    if (existingIndex >= 0) {
      // Update existing job with higher priority if needed
      if (job.priority > this.queue[existingIndex].priority) {
        this.queue[existingIndex] = queueItem;
        this.sortQueue();
      }
      return;
    }

    // Add new job
    this.queue.push(queueItem);
    this.sortQueue();
  }

  /**
   * Add multiple jobs to the queue
   * @param jobs Array of sync jobs
   */
  addJobs(jobs: SyncJob[]): void {
    jobs.forEach(job => this.addJob(job));
  }

  /**
   * Start processing the queue
   * Requirement 4.5: Concurrency control
   */
  async start(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    while (this.isProcessing && (this.queue.length > 0 || this.running.size > 0)) {
      // Process jobs up to max concurrency
      while (
        this.running.size < this.config.maxConcurrency &&
        this.queue.length > 0
      ) {
        const job = this.getNextJob();
        if (job) {
          this.processJob(job);
        } else {
          break;
        }
      }

      // Wait a bit before checking again
      await this.sleep(100);
    }

    this.isProcessing = false;
  }

  /**
   * Stop processing the queue
   */
  stop(): void {
    this.isProcessing = false;
  }

  /**
   * Clear all jobs from the queue
   */
  clear(): void {
    this.queue = [];
    this.completed.clear();
    this.failed.clear();
  }

  /**
   * Get queue statistics
   * Requirement 9.1: Monitoring metrics
   */
  getStats(): QueueStats {
    const completedResults = Array.from(this.completed.values());
    const totalDuration = completedResults.reduce(
      (sum, result) => sum + result.duration_ms,
      0
    );
    const averageDuration =
      completedResults.length > 0 ? totalDuration / completedResults.length : 0;

    return {
      total_jobs:
        this.queue.length +
        this.running.size +
        this.completed.size +
        this.failed.size,
      pending_jobs: this.queue.length,
      running_jobs: this.running.size,
      failed_jobs: this.failed.size,
      completed_jobs: this.completed.size,
      average_duration_ms: Math.round(averageDuration)
    };
  }

  /**
   * Get next job from queue that's ready to process
   * Respects backoff delays
   * @returns Next job or null
   */
  private getNextJob(): QueueItem | null {
    const now = new Date();

    // Find first job that's not in backoff
    const index = this.queue.findIndex(
      job => !job.backoff_until || job.backoff_until <= now
    );

    if (index < 0) {
      return null;
    }

    // Remove and return job
    const [job] = this.queue.splice(index, 1);
    return job;
  }

  /**
   * Process a single sync job
   * Requirement 4.5: Retry logic with exponential backoff
   * @param job Job to process
   */
  private async processJob(job: QueueItem): Promise<void> {
    const jobKey = `${job.client_id}_${job.platform}`;
    
    // Mark as running
    this.running.set(jobKey, job);
    job.attempts++;
    job.last_attempt_at = new Date();

    try {
      // Execute sync
      const result = await this.syncEngine.syncClient(
        job.client_id,
        job.platform
      );

      // Remove from running
      this.running.delete(jobKey);

      if (result.success) {
        // Mark as completed
        this.completed.set(jobKey, result);
      } else {
        // Sync failed - check if we should retry
        await this.handleFailedJob(job, result.error);
      }
    } catch (error) {
      // Remove from running
      this.running.delete(jobKey);

      // Handle error
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      await this.handleFailedJob(job, errorMessage);
    }
  }

  /**
   * Handle a failed job with retry logic
   * Requirement 9.2: Exponential backoff
   * @param job Failed job
   * @param error Error message
   */
  private async handleFailedJob(job: QueueItem, error?: string): Promise<void> {
    job.last_error = error;

    // Check if we should retry
    if (job.attempts < this.config.maxRetries) {
      // Calculate backoff delay
      const backoffMs = Math.min(
        this.config.initialBackoffMs *
          Math.pow(this.config.backoffMultiplier, job.attempts - 1),
        this.config.maxBackoffMs
      );

      // Set backoff time
      job.backoff_until = new Date(Date.now() + backoffMs);

      // Re-add to queue
      this.queue.push(job);
      this.sortQueue();

      console.log(
        `Job ${job.client_id}/${job.platform} failed (attempt ${job.attempts}/${this.config.maxRetries}). ` +
          `Retrying in ${backoffMs}ms. Error: ${error}`
      );
    } else {
      // Max retries reached - mark as failed
      const jobKey = `${job.client_id}_${job.platform}`;
      this.failed.set(jobKey, job);

      console.error(
        `Job ${job.client_id}/${job.platform} failed after ${job.attempts} attempts. ` +
          `Error: ${error}`
      );
    }
  }

  /**
   * Sort queue by priority (highest first)
   */
  private sortQueue(): void {
    this.queue.sort((a, b) => {
      // First sort by backoff (jobs not in backoff come first)
      const now = new Date();
      const aReady = !a.backoff_until || a.backoff_until <= now;
      const bReady = !b.backoff_until || b.backoff_until <= now;

      if (aReady && !bReady) return -1;
      if (!aReady && bReady) return 1;

      // Then sort by priority
      return b.priority - a.priority;
    });
  }

  /**
   * Sleep for specified milliseconds
   * @param ms Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get failed jobs for inspection
   * @returns Array of failed jobs
   */
  getFailedJobs(): QueueItem[] {
    return Array.from(this.failed.values());
  }

  /**
   * Get completed results
   * @returns Array of sync results
   */
  getCompletedResults(): SyncResult[] {
    return Array.from(this.completed.values());
  }

  /**
   * Retry a failed job
   * @param clientId Client ID
   * @param platform Platform
   * @returns True if job was found and re-queued
   */
  retryFailedJob(clientId: string, platform: AdPlatform): boolean {
    const jobKey = `${clientId}_${platform}`;
    const failedJob = this.failed.get(jobKey);

    if (!failedJob) {
      return false;
    }

    // Reset attempts and re-add to queue
    failedJob.attempts = 0;
    failedJob.backoff_until = undefined;
    failedJob.last_error = undefined;

    this.failed.delete(jobKey);
    this.queue.push(failedJob);
    this.sortQueue();

    return true;
  }

  /**
   * Retry all failed jobs
   * @returns Number of jobs re-queued
   */
  retryAllFailedJobs(): number {
    const failedJobs = Array.from(this.failed.values());
    
    failedJobs.forEach(job => {
      job.attempts = 0;
      job.backoff_until = undefined;
      job.last_error = undefined;
      this.queue.push(job);
    });

    this.failed.clear();
    this.sortQueue();

    return failedJobs.length;
  }

  /**
   * Check if queue is empty (no pending or running jobs)
   * @returns True if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0 && this.running.size === 0;
  }

  /**
   * Check if queue is processing
   * @returns True if processing
   */
  isRunning(): boolean {
    return this.isProcessing;
  }
}
