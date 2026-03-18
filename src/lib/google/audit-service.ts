/**
 * Google Ads Audit Service
 * 
 * Handles audit logging for sensitive operations and data access
 * Requirements: 2.1, 2.2
 */

import { createServiceClient } from '@/lib/supabase/server';
import { GoogleAdsCryptoService } from './crypto-service';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface AuditLogEntry {
  operation: AuditOperation;
  resourceType: AuditResourceType;
  resourceId?: string;
  userId?: string;
  clientId?: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
  sensitiveData?: boolean;
}

export type AuditOperation = 
  | 'connect'
  | 'disconnect' 
  | 'sync'
  | 'view_campaigns'
  | 'view_metrics'
  | 'export_data'
  | 'token_refresh'
  | 'token_encrypt'
  | 'token_decrypt'
  | 'key_rotation'
  | 'admin_access'
  | 'config_change'
  | 'data_access'
  | 'api_call';

export type AuditResourceType =
  | 'google_ads_connection'
  | 'google_ads_campaign'
  | 'google_ads_metrics'
  | 'encryption_key'
  | 'access_token'
  | 'refresh_token'
  | 'api_endpoint'
  | 'export_file'
  | 'admin_panel'
  | 'configuration';

export interface AuditQuery {
  operation?: AuditOperation;
  resourceType?: AuditResourceType;
  userId?: string;
  clientId?: string;
  startDate?: Date;
  endDate?: Date;
  success?: boolean;
  sensitiveData?: boolean;
  limit?: number;
  offset?: number;
}

export interface AuditSummary {
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  uniqueUsers: number;
  uniqueClients: number;
  topOperations: Array<{
    operation: AuditOperation;
    count: number;
  }>;
  recentFailures: AuditLogEntry[];
  suspiciousActivity: AuditLogEntry[];
}

// ============================================================================
// Audit Service Class
// ============================================================================

export class GoogleAdsAuditService {
  private readonly MAX_METADATA_SIZE = 10000; // 10KB limit for metadata
  private readonly SENSITIVE_OPERATIONS = new Set<AuditOperation>([
    'token_encrypt',
    'token_decrypt', 
    'key_rotation',
    'admin_access',
    'export_data'
  ]);

  constructor() {
    // Initialize audit service
  }

  // ==========================================================================
  // Core Audit Logging
  // ==========================================================================

  /**
   * Log an audit event
   */
  async logEvent(entry: AuditLogEntry): Promise<string | null> {
    try {
      const supabase = createServiceClient();

      // Sanitize and prepare data
      const sanitizedEntry = this.sanitizeAuditEntry(entry);
      
      // Determine if this is sensitive data
      const isSensitive = this.isSensitiveOperation(entry.operation) || entry.sensitiveData;

      // Create audit log record
      const { data, error } = await supabase
        .from('google_ads_audit_log')
        .insert({
          operation: sanitizedEntry.operation,
          resource_type: sanitizedEntry.resourceType,
          resource_id: sanitizedEntry.resourceId,
          user_id: sanitizedEntry.userId,
          client_id: sanitizedEntry.clientId,
          ip_address: sanitizedEntry.ipAddress,
          user_agent: this.truncateUserAgent(sanitizedEntry.userAgent),
          success: sanitizedEntry.success,
          error_message: sanitizedEntry.errorMessage,
          metadata: sanitizedEntry.metadata ? JSON.stringify(sanitizedEntry.metadata) : null,
          sensitive_data: isSensitive,
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) {
        console.error('[Audit Service] Error logging audit event:', error);
        return null;
      }

      // Log to console for immediate visibility (without sensitive data)
      this.logToConsole(sanitizedEntry, isSensitive);

      return data.id;
    } catch (error) {
      console.error('[Audit Service] Failed to log audit event:', error);
      return null;
    }
  }

  /**
   * Log connection events
   */
  async logConnection(
    operation: 'connect' | 'disconnect',
    connectionId: string,
    clientId: string,
    userId?: string,
    success: boolean = true,
    errorMessage?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logEvent({
      operation,
      resourceType: 'google_ads_connection',
      resourceId: connectionId,
      userId,
      clientId,
      success,
      errorMessage,
      metadata: {
        ...metadata,
        connectionId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log data access events
   */
  async logDataAccess(
    operation: AuditOperation,
    resourceType: AuditResourceType,
    resourceId: string,
    clientId: string,
    userId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logEvent({
      operation,
      resourceType,
      resourceId,
      userId,
      clientId,
      success: true,
      metadata: {
        ...metadata,
        accessTime: new Date().toISOString(),
      },
    });
  }

  /**
   * Log token operations
   */
  async logTokenOperation(
    operation: 'token_encrypt' | 'token_decrypt' | 'token_refresh',
    connectionId: string,
    clientId: string,
    success: boolean = true,
    errorMessage?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logEvent({
      operation,
      resourceType: 'access_token',
      resourceId: connectionId,
      clientId,
      success,
      errorMessage,
      metadata: {
        ...metadata,
        // Never log actual token values
        tokenHash: metadata?.tokenHash ? 
          GoogleAdsCryptoService.generateTokenHash(metadata.tokenHash) : 
          undefined,
      },
      sensitiveData: true,
    });
  }

  /**
   * Log API calls
   */
  async logApiCall(
    endpoint: string,
    clientId: string,
    userId?: string,
    success: boolean = true,
    responseTime?: number,
    errorMessage?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logEvent({
      operation: 'api_call',
      resourceType: 'api_endpoint',
      resourceId: endpoint,
      userId,
      clientId,
      success,
      errorMessage,
      metadata: {
        ...metadata,
        endpoint,
        responseTime,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log export operations
   */
  async logExport(
    exportType: string,
    clientId: string,
    userId?: string,
    success: boolean = true,
    fileSize?: number,
    recordCount?: number,
    errorMessage?: string
  ): Promise<void> {
    await this.logEvent({
      operation: 'export_data',
      resourceType: 'export_file',
      resourceId: `${exportType}_${Date.now()}`,
      userId,
      clientId,
      success,
      errorMessage,
      metadata: {
        exportType,
        fileSize,
        recordCount,
        timestamp: new Date().toISOString(),
      },
      sensitiveData: true,
    });
  }

  /**
   * Log admin access
   */
  async logAdminAccess(
    operation: string,
    resourceId: string,
    userId: string,
    success: boolean = true,
    errorMessage?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logEvent({
      operation: 'admin_access',
      resourceType: 'admin_panel',
      resourceId,
      userId,
      success,
      errorMessage,
      metadata: {
        ...metadata,
        adminOperation: operation,
        timestamp: new Date().toISOString(),
      },
      sensitiveData: true,
    });
  }

  /**
   * Log configuration changes
   */
  async logConfigChange(
    configType: string,
    oldValue: any,
    newValue: any,
    userId: string,
    clientId?: string
  ): Promise<void> {
    await this.logEvent({
      operation: 'config_change',
      resourceType: 'configuration',
      resourceId: configType,
      userId,
      clientId,
      success: true,
      metadata: {
        configType,
        oldValue: this.sanitizeConfigValue(oldValue),
        newValue: this.sanitizeConfigValue(newValue),
        timestamp: new Date().toISOString(),
      },
      sensitiveData: true,
    });
  }

  // ==========================================================================
  // Audit Query and Analysis
  // ==========================================================================

  /**
   * Query audit logs
   */
  async queryLogs(query: AuditQuery): Promise<AuditLogEntry[]> {
    try {
      const supabase = createServiceClient();

      let queryBuilder = supabase
        .from('google_ads_audit_log')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filters
      if (query.operation) {
        queryBuilder = queryBuilder.eq('operation', query.operation);
      }

      if (query.resourceType) {
        queryBuilder = queryBuilder.eq('resource_type', query.resourceType);
      }

      if (query.userId) {
        queryBuilder = queryBuilder.eq('user_id', query.userId);
      }

      if (query.clientId) {
        queryBuilder = queryBuilder.eq('client_id', query.clientId);
      }

      if (query.success !== undefined) {
        queryBuilder = queryBuilder.eq('success', query.success);
      }

      if (query.sensitiveData !== undefined) {
        queryBuilder = queryBuilder.eq('sensitive_data', query.sensitiveData);
      }

      if (query.startDate) {
        queryBuilder = queryBuilder.gte('created_at', query.startDate.toISOString());
      }

      if (query.endDate) {
        queryBuilder = queryBuilder.lte('created_at', query.endDate.toISOString());
      }

      if (query.limit) {
        queryBuilder = queryBuilder.limit(query.limit);
      }

      if (query.offset) {
        queryBuilder = queryBuilder.range(query.offset, query.offset + (query.limit || 100) - 1);
      }

      const { data, error } = await queryBuilder;

      if (error) {
        throw error;
      }

      return (data || []).map(this.mapDatabaseToAuditEntry);
    } catch (error) {
      console.error('[Audit Service] Error querying audit logs:', error);
      return [];
    }
  }

  /**
   * Get audit summary for a time period
   */
  async getAuditSummary(
    startDate: Date,
    endDate: Date,
    clientId?: string
  ): Promise<AuditSummary> {
    try {
      const supabase = createServiceClient();

      // Base query
      let baseQuery = supabase
        .from('google_ads_audit_log')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (clientId) {
        baseQuery = baseQuery.eq('client_id', clientId);
      }

      const { data: logs, error } = await baseQuery;

      if (error || !logs) {
        throw error || new Error('No audit logs found');
      }

      // Calculate summary statistics
      const totalEvents = logs.length;
      const successfulEvents = logs.filter(log => log.success).length;
      const failedEvents = totalEvents - successfulEvents;
      const uniqueUsers = new Set(logs.map(log => log.user_id).filter(Boolean)).size;
      const uniqueClients = new Set(logs.map(log => log.client_id).filter(Boolean)).size;

      // Top operations
      const operationCounts = logs.reduce((acc, log) => {
        acc[log.operation] = (acc[log.operation] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const topOperations = Object.entries(operationCounts)
        .map(([operation, count]) => ({ operation: operation as AuditOperation, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Recent failures
      const recentFailures = logs
        .filter(log => !log.success)
        .slice(0, 10)
        .map(this.mapDatabaseToAuditEntry);

      // Suspicious activity detection
      const suspiciousActivity = this.detectSuspiciousActivity(logs)
        .map(this.mapDatabaseToAuditEntry);

      return {
        totalEvents,
        successfulEvents,
        failedEvents,
        uniqueUsers,
        uniqueClients,
        topOperations,
        recentFailures,
        suspiciousActivity,
      };
    } catch (error) {
      console.error('[Audit Service] Error generating audit summary:', error);
      return {
        totalEvents: 0,
        successfulEvents: 0,
        failedEvents: 0,
        uniqueUsers: 0,
        uniqueClients: 0,
        topOperations: [],
        recentFailures: [],
        suspiciousActivity: [],
      };
    }
  }

  /**
   * Detect suspicious activity patterns
   */
  private detectSuspiciousActivity(logs: any[]): any[] {
    const suspicious: any[] = [];
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Multiple failed login attempts
    const recentFailures = logs.filter(log => 
      !log.success && 
      new Date(log.created_at) > oneHourAgo
    );

    const failuresByUser = recentFailures.reduce((acc, log) => {
      if (log.user_id) {
        acc[log.user_id] = (acc[log.user_id] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    // Flag users with more than 5 failures in the last hour
    Object.entries(failuresByUser).forEach(([userId, count]) => {
      if (count > 5) {
        const userFailures = recentFailures.filter(log => log.user_id === userId);
        suspicious.push(...userFailures);
      }
    });

    // Unusual access patterns (accessing multiple clients rapidly)
    const recentAccess = logs.filter(log => 
      new Date(log.created_at) > oneHourAgo &&
      log.operation === 'data_access'
    );

    const accessByUser = recentAccess.reduce((acc, log) => {
      if (log.user_id) {
        if (!acc[log.user_id]) {
          acc[log.user_id] = new Set();
        }
        acc[log.user_id].add(log.client_id);
      }
      return acc;
    }, {} as Record<string, Set<string>>);

    // Flag users accessing more than 10 different clients in an hour
    Object.entries(accessByUser).forEach(([userId, clientIds]) => {
      if (clientIds.size > 10) {
        const userAccess = recentAccess.filter(log => log.user_id === userId);
        suspicious.push(...userAccess);
      }
    });

    return suspicious.slice(0, 20); // Limit to 20 most recent suspicious events
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Sanitize audit entry data
   */
  private sanitizeAuditEntry(entry: AuditLogEntry): AuditLogEntry {
    const sanitized = { ...entry };

    // Truncate long strings
    if (sanitized.errorMessage && sanitized.errorMessage.length > 1000) {
      sanitized.errorMessage = sanitized.errorMessage.substring(0, 1000) + '...';
    }

    // Limit metadata size
    if (sanitized.metadata) {
      const metadataStr = JSON.stringify(sanitized.metadata);
      if (metadataStr.length > this.MAX_METADATA_SIZE) {
        sanitized.metadata = {
          ...sanitized.metadata,
          _truncated: true,
          _originalSize: metadataStr.length,
        };
        
        // Remove large fields until under limit
        const keys = Object.keys(sanitized.metadata);
        for (const key of keys) {
          if (JSON.stringify(sanitized.metadata).length <= this.MAX_METADATA_SIZE) {
            break;
          }
          delete sanitized.metadata[key];
        }
      }
    }

    return sanitized;
  }

  /**
   * Check if operation is sensitive
   */
  private isSensitiveOperation(operation: AuditOperation): boolean {
    return this.SENSITIVE_OPERATIONS.has(operation);
  }

  /**
   * Truncate user agent string
   */
  private truncateUserAgent(userAgent?: string): string | undefined {
    if (!userAgent) return undefined;
    return userAgent.length > 500 ? userAgent.substring(0, 500) + '...' : userAgent;
  }

  /**
   * Sanitize configuration values (remove sensitive data)
   */
  private sanitizeConfigValue(value: any): any {
    if (typeof value === 'string') {
      // Hide potential secrets/tokens
      if (value.length > 20 && (
        value.includes('token') || 
        value.includes('key') || 
        value.includes('secret')
      )) {
        return '[REDACTED]';
      }
    }
    
    if (typeof value === 'object' && value !== null) {
      const sanitized: any = {};
      for (const [key, val] of Object.entries(value)) {
        if (key.toLowerCase().includes('token') || 
            key.toLowerCase().includes('key') || 
            key.toLowerCase().includes('secret') ||
            key.toLowerCase().includes('password')) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = val;
        }
      }
      return sanitized;
    }

    return value;
  }

  /**
   * Log to console (without sensitive data)
   */
  private logToConsole(entry: AuditLogEntry, isSensitive: boolean): void {
    const logLevel = entry.success ? 'info' : 'warn';
    const sensitiveFlag = isSensitive ? '[SENSITIVE] ' : '';
    
    console[logLevel](
      `[Audit] ${sensitiveFlag}${entry.operation} on ${entry.resourceType}` +
      (entry.resourceId ? ` (${entry.resourceId})` : '') +
      (entry.clientId ? ` for client ${entry.clientId}` : '') +
      `: ${entry.success ? 'SUCCESS' : 'FAILED'}` +
      (entry.errorMessage ? ` - ${entry.errorMessage}` : '')
    );
  }

  /**
   * Map database record to audit entry
   */
  private mapDatabaseToAuditEntry(dbRecord: any): AuditLogEntry {
    return {
      operation: dbRecord.operation,
      resourceType: dbRecord.resource_type,
      resourceId: dbRecord.resource_id,
      userId: dbRecord.user_id,
      clientId: dbRecord.client_id,
      ipAddress: dbRecord.ip_address,
      userAgent: dbRecord.user_agent,
      success: dbRecord.success,
      errorMessage: dbRecord.error_message,
      metadata: dbRecord.metadata ? JSON.parse(dbRecord.metadata) : undefined,
      sensitiveData: dbRecord.sensitive_data,
    };
  }

  // ==========================================================================
  // Cleanup and Maintenance
  // ==========================================================================

  /**
   * Clean up old audit logs (keep last 6 months by default)
   */
  async cleanupOldLogs(retentionDays: number = 180): Promise<number> {
    try {
      const supabase = createServiceClient();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const { data, error } = await supabase
        .from('google_ads_audit_log')
        .delete()
        .lt('created_at', cutoffDate.toISOString())
        .select('id');

      if (error) {
        throw error;
      }

      const deletedCount = data?.length || 0;
      console.log(`[Audit Service] Cleaned up ${deletedCount} old audit logs`);
      
      return deletedCount;
    } catch (error) {
      console.error('[Audit Service] Error cleaning up old logs:', error);
      return 0;
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let auditServiceInstance: GoogleAdsAuditService | null = null;

/**
 * Get singleton instance of GoogleAdsAuditService
 */
export function getGoogleAdsAuditService(): GoogleAdsAuditService {
  if (!auditServiceInstance) {
    auditServiceInstance = new GoogleAdsAuditService();
  }
  return auditServiceInstance;
}