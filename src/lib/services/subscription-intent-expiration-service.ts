/**
 * Subscription Intent Expiration Service
 * 
 * Handles expiration logic, cleanup, and notifications for subscription intents.
 * Implements cron job functionality and automated cleanup processes.
 * 
 * Requirements: 5.1, 6.3
 */

import { createClient } from '@supabase/supabase-js';
import {
  SubscriptionIntent,
  SubscriptionIntentStatus,
  SubscriptionIntentError,
  SubscriptionIntentMetrics,
} from '@/lib/types/subscription-intent';
import { 
  SubscriptionIntentService,
  createSubscriptionIntentService,
} from './subscription-intent-service';

// =============================================
// EXPIRATION SERVICE TYPES
// =============================================

export interface ExpirationConfig {
  defaultExpirationDays: number;
  warningDays: number; // Days before expiration to send warning
  batchSize: number;
  notificationEnabled: boolean;
  cleanupRetentionDays: number; // How long to keep expired intents
}

export interface ExpirationJob {
  id: string;
  type: 'cleanup' | 'warning' | 'expire';
  status: 'pending' | 'running' | 'completed' | 'failed';
  processed_count: number;
  error_count: number;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
}

export interface ExpirationMetrics {
  total_expired: number;
  expired_today: number;
  expiring_soon: number; // Within warning period
  cleanup_candidates: number; // Old expired intents ready for cleanup
  abandonment_rate: number;
  average_time_to_expiration: number; // in hours
}

export interface ExpirationNotification {
  intent_id: string;
  user_email: string;
  user_name: string;
  organization_name: string;
  expires_at: string;
  days_until_expiration: number;
  checkout_url?: string;
  notification_type: 'warning' | 'expired';
}

// =============================================
// EXPIRATION SERVICE
// =============================================

export class SubscriptionIntentExpirationService {
  private supabase;
  private intentService: SubscriptionIntentService;
  private config: ExpirationConfig;

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    config?: Partial<ExpirationConfig>
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.intentService = new SubscriptionIntentService(supabaseUrl, supabaseKey);
    this.config = {
      defaultExpirationDays: 7,
      warningDays: 1, // Send warning 1 day before expiration
      batchSize: 100,
      notificationEnabled: true,
      cleanupRetentionDays: 30, // Keep expired intents for 30 days
      ...config,
    };
  }

  // =============================================
  // EXPIRATION PROCESSING
  // =============================================

  /**
   * Process expired subscription intents (main cron job function)
   */
  async processExpiredIntents(): Promise<ExpirationJob> {
    const job: ExpirationJob = {
      id: crypto.randomUUID(),
      type: 'expire',
      status: 'pending',
      processed_count: 0,
      error_count: 0,
      started_at: new Date().toISOString(),
    };

    try {
      job.status = 'running';
      await this.logExpirationJob(job);

      // Get intents that should be expired
      const expiredIntents = await this.getExpiredIntents();
      
      for (const intent of expiredIntents) {
        try {
          // Update status to expired using state machine
          await this.intentService.executeStateTransition(
            intent.id,
            'expired',
            {
              reason: 'Automatic expiration due to timeout',
              triggeredBy: 'expiration_service',
              metadata: {
                expired_at: new Date().toISOString(),
                original_expires_at: intent.expires_at,
              },
            }
          );

          // Send expiration notification
          if (this.config.notificationEnabled) {
            await this.sendExpirationNotification({
              intent_id: intent.id,
              user_email: intent.user_email,
              user_name: intent.user_name,
              organization_name: intent.organization_name,
              expires_at: intent.expires_at,
              days_until_expiration: 0,
              checkout_url: intent.checkout_url,
              notification_type: 'expired',
            });
          }

          job.processed_count++;
        } catch (error) {
          console.error(`Failed to expire intent ${intent.id}:`, error);
          job.error_count++;
        }
      }

      job.status = 'completed';
      job.completed_at = new Date().toISOString();

    } catch (error) {
      job.status = 'failed';
      job.error_message = error.message;
      job.completed_at = new Date().toISOString();
    }

    await this.logExpirationJob(job);
    return job;
  }

  /**
   * Send warning notifications for intents expiring soon
   */
  async processExpirationWarnings(): Promise<ExpirationJob> {
    const job: ExpirationJob = {
      id: crypto.randomUUID(),
      type: 'warning',
      status: 'pending',
      processed_count: 0,
      error_count: 0,
      started_at: new Date().toISOString(),
    };

    try {
      job.status = 'running';
      await this.logExpirationJob(job);

      if (!this.config.notificationEnabled) {
        job.status = 'completed';
        job.completed_at = new Date().toISOString();
        await this.logExpirationJob(job);
        return job;
      }

      // Get intents expiring soon that haven't been warned yet
      const expiringSoonIntents = await this.getIntentsExpiringSoon();
      
      for (const intent of expiringSoonIntents) {
        try {
          const daysUntilExpiration = Math.ceil(
            (new Date(intent.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );

          // Send warning notification
          await this.sendExpirationNotification({
            intent_id: intent.id,
            user_email: intent.user_email,
            user_name: intent.user_name,
            organization_name: intent.organization_name,
            expires_at: intent.expires_at,
            days_until_expiration: daysUntilExpiration,
            checkout_url: intent.checkout_url,
            notification_type: 'warning',
          });

          // Mark as warned in metadata
          await this.intentService.updateIntent(intent.id, {
            metadata: {
              ...intent.metadata,
              expiration_warning_sent: true,
              expiration_warning_sent_at: new Date().toISOString(),
            },
          });

          job.processed_count++;
        } catch (error) {
          console.error(`Failed to send warning for intent ${intent.id}:`, error);
          job.error_count++;
        }
      }

      job.status = 'completed';
      job.completed_at = new Date().toISOString();

    } catch (error) {
      job.status = 'failed';
      job.error_message = error.message;
      job.completed_at = new Date().toISOString();
    }

    await this.logExpirationJob(job);
    return job;
  }

  /**
   * Clean up old expired intents
   */
  async processExpiredIntentCleanup(): Promise<ExpirationJob> {
    const job: ExpirationJob = {
      id: crypto.randomUUID(),
      type: 'cleanup',
      status: 'pending',
      processed_count: 0,
      error_count: 0,
      started_at: new Date().toISOString(),
    };

    try {
      job.status = 'running';
      await this.logExpirationJob(job);

      // Use database function for cleanup
      const { data: cleanupCount, error } = await this.supabase
        .rpc('cleanup_expired_subscription_intents');

      if (error) {
        throw new SubscriptionIntentError(
          `Cleanup failed: ${error.message}`,
          'CLEANUP_FAILED'
        );
      }

      job.processed_count = cleanupCount || 0;
      job.status = 'completed';
      job.completed_at = new Date().toISOString();

    } catch (error) {
      job.status = 'failed';
      job.error_message = error.message;
      job.completed_at = new Date().toISOString();
    }

    await this.logExpirationJob(job);
    return job;
  }

  // =============================================
  // QUERY METHODS
  // =============================================

  /**
   * Get intents that have expired but are not marked as expired
   */
  private async getExpiredIntents(): Promise<SubscriptionIntent[]> {
    const { data, error } = await this.supabase
      .from('subscription_intents')
      .select('*')
      .in('status', ['pending', 'processing', 'failed'])
      .lt('expires_at', new Date().toISOString())
      .limit(this.config.batchSize);

    if (error) {
      throw new SubscriptionIntentError(
        `Failed to get expired intents: ${error.message}`,
        'QUERY_FAILED'
      );
    }

    return (data || []).map(item => this.mapDatabaseToIntent(item));
  }

  /**
   * Get intents expiring soon that need warning notifications
   */
  private async getIntentsExpiringSoon(): Promise<SubscriptionIntent[]> {
    const warningDate = new Date();
    warningDate.setDate(warningDate.getDate() + this.config.warningDays);

    const { data, error } = await this.supabase
      .from('subscription_intents')
      .select('*')
      .in('status', ['pending', 'processing'])
      .lt('expires_at', warningDate.toISOString())
      .gt('expires_at', new Date().toISOString())
      .not('metadata->expiration_warning_sent', 'eq', true)
      .limit(this.config.batchSize);

    if (error) {
      throw new SubscriptionIntentError(
        `Failed to get intents expiring soon: ${error.message}`,
        'QUERY_FAILED'
      );
    }

    return (data || []).map(item => this.mapDatabaseToIntent(item));
  }

  // =============================================
  // METRICS AND ANALYTICS
  // =============================================

  /**
   * Get expiration metrics
   */
  async getExpirationMetrics(): Promise<ExpirationMetrics> {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const warningDate = new Date();
      warningDate.setDate(warningDate.getDate() + this.config.warningDays);
      const cleanupDate = new Date();
      cleanupDate.setDate(cleanupDate.getDate() - this.config.cleanupRetentionDays);

      // Get various counts
      const [
        totalExpiredResult,
        expiredTodayResult,
        expiringSoonResult,
        cleanupCandidatesResult,
        totalIntentsResult,
        avgTimeResult,
      ] = await Promise.all([
        // Total expired
        this.supabase
          .from('subscription_intents')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'expired'),

        // Expired today
        this.supabase
          .from('subscription_intents')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'expired')
          .gte('updated_at', todayStart.toISOString()),

        // Expiring soon
        this.supabase
          .from('subscription_intents')
          .select('id', { count: 'exact', head: true })
          .in('status', ['pending', 'processing'])
          .lt('expires_at', warningDate.toISOString())
          .gt('expires_at', now.toISOString()),

        // Cleanup candidates
        this.supabase
          .from('subscription_intents')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'expired')
          .lt('updated_at', cleanupDate.toISOString()),

        // Total intents for abandonment rate
        this.supabase
          .from('subscription_intents')
          .select('id', { count: 'exact', head: true }),

        // Average time to expiration
        this.supabase
          .from('subscription_intents')
          .select('created_at, expires_at')
          .eq('status', 'expired')
          .limit(1000), // Sample for performance
      ]);

      const totalExpired = totalExpiredResult.count || 0;
      const expiredToday = expiredTodayResult.count || 0;
      const expiringSoon = expiringSoonResult.count || 0;
      const cleanupCandidates = cleanupCandidatesResult.count || 0;
      const totalIntents = totalIntentsResult.count || 0;

      // Calculate average time to expiration
      let averageTimeToExpiration = 0;
      if (avgTimeResult.data && avgTimeResult.data.length > 0) {
        const times = avgTimeResult.data.map(item => {
          const created = new Date(item.created_at).getTime();
          const expires = new Date(item.expires_at).getTime();
          return (expires - created) / (1000 * 60 * 60); // Convert to hours
        });
        averageTimeToExpiration = times.reduce((sum, time) => sum + time, 0) / times.length;
      }

      // Calculate abandonment rate
      const abandonmentRate = totalIntents > 0 ? (totalExpired / totalIntents) * 100 : 0;

      return {
        total_expired: totalExpired,
        expired_today: expiredToday,
        expiring_soon: expiringSoon,
        cleanup_candidates: cleanupCandidates,
        abandonment_rate: Math.round(abandonmentRate * 100) / 100,
        average_time_to_expiration: Math.round(averageTimeToExpiration * 100) / 100,
      };
    } catch (error) {
      throw new SubscriptionIntentError(
        `Failed to get expiration metrics: ${error.message}`,
        'METRICS_FAILED'
      );
    }
  }

  // =============================================
  // NOTIFICATION METHODS
  // =============================================

  /**
   * Send expiration notification
   */
  private async sendExpirationNotification(
    notification: ExpirationNotification
  ): Promise<void> {
    try {
      // Log notification event (actual email sending would be handled by notification service)
      await this.supabase
        .from('webhook_logs')
        .insert({
          event_type: `notification.expiration_${notification.notification_type}`,
          payload: {
            intent_id: notification.intent_id,
            user_email: notification.user_email,
            user_name: notification.user_name,
            organization_name: notification.organization_name,
            expires_at: notification.expires_at,
            days_until_expiration: notification.days_until_expiration,
            checkout_url: notification.checkout_url,
            notification_type: notification.notification_type,
          },
          status: 'pending',
        });
    } catch (error) {
      console.error('Failed to send expiration notification:', error);
    }
  }

  // =============================================
  // LOGGING METHODS
  // =============================================

  /**
   * Log expiration job execution
   */
  private async logExpirationJob(job: ExpirationJob): Promise<void> {
    try {
      await this.supabase
        .from('webhook_logs')
        .insert({
          event_type: `expiration.job_${job.type}`,
          payload: {
            job_id: job.id,
            status: job.status,
            processed_count: job.processed_count,
            error_count: job.error_count,
            started_at: job.started_at,
            completed_at: job.completed_at,
            error_message: job.error_message,
          },
          status: job.status === 'completed' ? 'completed' : 'pending',
          processed_at: job.completed_at || null,
        });
    } catch (error) {
      console.error('Failed to log expiration job:', error);
    }
  }

  // =============================================
  // UTILITY METHODS
  // =============================================

  /**
   * Map database row to SubscriptionIntent type
   */
  private mapDatabaseToIntent(data: any): SubscriptionIntent {
    return {
      id: data.id,
      plan_id: data.plan_id,
      billing_cycle: data.billing_cycle,
      status: data.status,
      user_email: data.user_email,
      user_name: data.user_name,
      organization_name: data.organization_name,
      cpf_cnpj: data.cpf_cnpj,
      phone: data.phone,
      iugu_customer_id: data.iugu_customer_id,
      iugu_subscription_id: data.iugu_subscription_id,
      checkout_url: data.checkout_url,
      user_id: data.user_id,
      metadata: data.metadata || {},
      expires_at: data.expires_at,
      completed_at: data.completed_at,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  /**
   * Get configuration
   */
  getConfig(): ExpirationConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ExpirationConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// =============================================
// FACTORY FUNCTION
// =============================================

/**
 * Create a new SubscriptionIntentExpirationService instance
 */
export function createSubscriptionIntentExpirationService(
  config?: Partial<ExpirationConfig>
): SubscriptionIntentExpirationService {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase configuration');
  }

  return new SubscriptionIntentExpirationService(supabaseUrl, supabaseKey, config);
}

// =============================================
// SINGLETON INSTANCE
// =============================================

let expirationServiceInstance: SubscriptionIntentExpirationService | null = null;

/**
 * Get singleton instance of SubscriptionIntentExpirationService
 */
export function getSubscriptionIntentExpirationService(): SubscriptionIntentExpirationService {
  if (!expirationServiceInstance) {
    expirationServiceInstance = createSubscriptionIntentExpirationService();
  }
  return expirationServiceInstance;
}