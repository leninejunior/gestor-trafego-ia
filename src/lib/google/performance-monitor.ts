/**
 * Google Ads Performance Monitor
 * 
 * Tracks and analyzes performance metrics for Google Ads operations
 * Requirements: 10.3, 10.5
 */

import { createClient } from '@/lib/supabase/server';
import { googleAdsLogger } from './logger';

export interface PerformanceMetrics {
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  memoryStart?: number;
  memoryEnd?: number;
  memoryUsage?: number;
  recordsProcessed?: number;
  apiCalls?: number;
  errors?: number;
  metadata?: Record<string, any>;
}

export interface PerformanceThresholds {
  maxDuration: number; // milliseconds
  maxMemoryUsage: number; // bytes
  maxApiCalls: number;
  maxErrorRate: number; // 0.0 to 1.0
}

export class GoogleAdsPerformanceMonitor {
  private readonly DEFAULT_THRESHOLDS: PerformanceThresholds = {
    maxDuration: 30000, // 30 seconds
    maxMemoryUsage: 100 * 1024 * 1024, // 100MB
    maxApiCalls: 100,
    maxErrorRate: 0.1 // 10%
  };

  private activeOperations = new Map<string, PerformanceMetrics>();

  /**
   * Start monitoring an operation
   */
  startOperation(
    operationId: string,
    operationName: string,
    metadata?: Record<string, any>
  ): string {
    const metrics: PerformanceMetrics = {
      operation: operationName,
      startTime: Date.now(),
      memoryStart: this.getMemoryUsage(),
      recordsProcessed: 0,
      apiCalls: 0,
      errors: 0,
      metadata: metadata || {}
    };

    this.activeOperations.set(operationId, metrics);

    googleAdsLogger.debug(`Performance monitoring started: ${operationName}`, {
      operation: 'performance_monitor',
      requestId: operationId,
      metadata: { operationName, ...metadata }
    });

    return operationId;
  }

  /**
   * Update operation metrics
   */
  updateOperation(
    operationId: string,
    updates: Partial<Pick<PerformanceMetrics, 'recordsProcessed' | 'apiCalls' | 'errors' | 'metadata'>>
  ): void {
    const metrics = this.activeOperations.get(operationId);
    if (!metrics) return;

    if (updates.recordsProcessed !== undefined) {
      metrics.recordsProcessed = updates.recordsProcessed;
    }
    if (updates.apiCalls !== undefined) {
      metrics.apiCalls = updates.apiCalls;
    }
    if (updates.errors !== undefined) {
      metrics.errors = updates.errors;
    }
    if (updates.metadata) {
      metrics.metadata = { ...metrics.metadata, ...updates.metadata };
    }

    this.activeOperations.set(operationId, metrics);
  }

  /**
   * Finish monitoring an operation
   */
  async finishOperation(
    operationId: string,
    context?: {
      connectionId?: string;
      clientId?: string;
      userId?: string;
    }
  ): Promise<PerformanceMetrics | null> {
    const metrics = this.activeOperations.get(operationId);
    if (!metrics) return null;

    // Calculate final metrics
    metrics.endTime = Date.now();
    metrics.duration = metrics.endTime - metrics.startTime;
    metrics.memoryEnd = this.getMemoryUsage();
    metrics.memoryUsage = metrics.memoryEnd - (metrics.memoryStart || 0);

    // Remove from active operations
    this.activeOperations.delete(operationId);

    // Check thresholds and log warnings
    await this.checkThresholds(metrics, operationId, context);

    // Store in database
    await this.storePerformanceMetrics(metrics, context);

    // Log completion
    googleAdsLogger.performance(metrics.operation, {
      duration: metrics.duration,
      memoryUsage: metrics.memoryUsage,
      recordsProcessed: metrics.recordsProcessed,
      apiCalls: metrics.apiCalls
    }, {
      operation: 'performance_monitor',
      requestId: operationId,
      ...context
    });

    return metrics;
  }

  /**
   * Get current operation status
   */
  getOperationStatus(operationId: string): PerformanceMetrics | null {
    const metrics = this.activeOperations.get(operationId);
    if (!metrics) return null;

    return {
      ...metrics,
      duration: Date.now() - metrics.startTime,
      memoryUsage: this.getMemoryUsage() - (metrics.memoryStart || 0)
    };
  }

  /**
   * Get all active operations
   */
  getActiveOperations(): Map<string, PerformanceMetrics> {
    return new Map(this.activeOperations);
  }

  /**
   * Get performance statistics for a time period
   */
  async getPerformanceStats(
    operation?: string,
    hours: number = 24
  ): Promise<{
    totalOperations: number;
    averageDuration: number;
    averageMemoryUsage: number;
    totalRecordsProcessed: number;
    totalApiCalls: number;
    errorRate: number;
    slowestOperations: Array<{
      operation: string;
      duration: number;
      created_at: string;
    }>;
  }> {
    try {
      const supabase = await createClient();
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);

      let query = supabase
        .from('google_ads_performance_logs')
        .select('*')
        .gte('created_at', since.toISOString());

      if (operation) {
        query = query.eq('operation', operation);
      }

      const { data: logs } = await query;

      if (!logs || logs.length === 0) {
        return {
          totalOperations: 0,
          averageDuration: 0,
          averageMemoryUsage: 0,
          totalRecordsProcessed: 0,
          totalApiCalls: 0,
          errorRate: 0,
          slowestOperations: []
        };
      }

      // Calculate statistics
      const totalOperations = logs.length;
      const averageDuration = logs.reduce((sum, log) => sum + log.duration, 0) / totalOperations;
      const averageMemoryUsage = logs.reduce((sum, log) => sum + (log.memory_usage || 0), 0) / totalOperations;
      const totalRecordsProcessed = logs.reduce((sum, log) => sum + (log.records_processed || 0), 0);
      const totalApiCalls = logs.reduce((sum, log) => sum + (log.api_calls || 0), 0);
      
      // Calculate error rate from metadata
      const operationsWithErrors = logs.filter(log => 
        log.metadata && typeof log.metadata === 'object' && 
        'errors' in log.metadata && log.metadata.errors > 0
      ).length;
      const errorRate = operationsWithErrors / totalOperations;

      // Get slowest operations
      const slowestOperations = logs
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 5)
        .map(log => ({
          operation: log.operation,
          duration: log.duration,
          created_at: log.created_at
        }));

      return {
        totalOperations,
        averageDuration,
        averageMemoryUsage,
        totalRecordsProcessed,
        totalApiCalls,
        errorRate,
        slowestOperations
      };

    } catch (error) {
      googleAdsLogger.error('Failed to get performance stats', error as Error);
      throw error;
    }
  }

  /**
   * Check if metrics exceed thresholds
   */
  private async checkThresholds(
    metrics: PerformanceMetrics,
    operationId: string,
    context?: {
      connectionId?: string;
      clientId?: string;
      userId?: string;
    }
  ): Promise<void> {
    const thresholds = this.DEFAULT_THRESHOLDS;
    const warnings: string[] = [];

    // Check duration threshold
    if (metrics.duration && metrics.duration > thresholds.maxDuration) {
      warnings.push(`Duration exceeded threshold: ${metrics.duration}ms > ${thresholds.maxDuration}ms`);
    }

    // Check memory usage threshold
    if (metrics.memoryUsage && metrics.memoryUsage > thresholds.maxMemoryUsage) {
      warnings.push(`Memory usage exceeded threshold: ${this.formatBytes(metrics.memoryUsage)} > ${this.formatBytes(thresholds.maxMemoryUsage)}`);
    }

    // Check API calls threshold
    if (metrics.apiCalls && metrics.apiCalls > thresholds.maxApiCalls) {
      warnings.push(`API calls exceeded threshold: ${metrics.apiCalls} > ${thresholds.maxApiCalls}`);
    }

    // Check error rate threshold
    if (metrics.errors && metrics.recordsProcessed) {
      const errorRate = metrics.errors / metrics.recordsProcessed;
      if (errorRate > thresholds.maxErrorRate) {
        warnings.push(`Error rate exceeded threshold: ${(errorRate * 100).toFixed(1)}% > ${(thresholds.maxErrorRate * 100).toFixed(1)}%`);
      }
    }

    // Log warnings
    if (warnings.length > 0) {
      googleAdsLogger.warn(`Performance thresholds exceeded for ${metrics.operation}`, {
        operation: 'performance_monitor',
        requestId: operationId,
        ...context,
        metadata: {
          warnings,
          metrics: {
            duration: metrics.duration,
            memoryUsage: metrics.memoryUsage,
            apiCalls: metrics.apiCalls,
            errorRate: metrics.errors && metrics.recordsProcessed 
              ? metrics.errors / metrics.recordsProcessed 
              : 0
          }
        }
      });
    }
  }

  /**
   * Store performance metrics in database
   */
  private async storePerformanceMetrics(
    metrics: PerformanceMetrics,
    context?: {
      connectionId?: string;
      clientId?: string;
      userId?: string;
    }
  ): Promise<void> {
    try {
      const supabase = await createClient();

      await supabase
        .from('google_ads_performance_logs')
        .insert({
          operation: metrics.operation,
          duration: metrics.duration!,
          memory_usage: metrics.memoryUsage,
          records_processed: metrics.recordsProcessed,
          api_calls: metrics.apiCalls,
          connection_id: context?.connectionId,
          client_id: context?.clientId,
          user_id: context?.userId,
          metadata: {
            ...metrics.metadata,
            errors: metrics.errors,
            startTime: metrics.startTime,
            endTime: metrics.endTime
          }
        });

    } catch (error) {
      googleAdsLogger.error('Failed to store performance metrics', error as Error, {
        operation: 'performance_monitor',
        metadata: { operation: metrics.operation }
      });
    }
  }

  /**
   * Get current memory usage
   */
  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Generate unique operation ID
   */
  static generateOperationId(operation: string): string {
    return `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
export const googleAdsPerformanceMonitor = new GoogleAdsPerformanceMonitor();