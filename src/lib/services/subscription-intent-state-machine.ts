/**
 * Subscription Intent State Machine
 * 
 * Implements state machine logic for subscription intent lifecycle management.
 * Handles state transitions, validation, and audit logging.
 * 
 * Requirements: 2.1, 4.1
 */

import { createClient } from '@supabase/supabase-js';
import {
  SubscriptionIntentStatus,
  StateTransition,
  StateMachineConfig,
  STATE_MACHINE_CONFIG,
  SubscriptionIntentError,
  InvalidStateTransitionError,
} from '@/lib/types/subscription-intent';

// =============================================
// STATE MACHINE TYPES
// =============================================

export interface StateTransitionContext {
  intentId: string;
  fromStatus: SubscriptionIntentStatus;
  toStatus: SubscriptionIntentStatus;
  reason?: string;
  metadata?: Record<string, any>;
  triggeredBy?: string; // user_id or system identifier
  timestamp: string;
}

export interface StateTransitionLog {
  id: string;
  subscription_intent_id: string;
  from_status: SubscriptionIntentStatus;
  to_status: SubscriptionIntentStatus;
  reason?: string;
  metadata: Record<string, any>;
  triggered_by?: string;
  created_at: string;
}

export interface StateTransitionRule {
  from: SubscriptionIntentStatus;
  to: SubscriptionIntentStatus;
  condition?: (context: StateTransitionContext) => boolean;
  beforeTransition?: (context: StateTransitionContext) => Promise<void>;
  afterTransition?: (context: StateTransitionContext) => Promise<void>;
  requiresReason?: boolean;
}

// =============================================
// STATE MACHINE SERVICE
// =============================================

export class SubscriptionIntentStateMachine {
  private supabase;
  private config: StateMachineConfig;
  private transitionRules: Map<string, StateTransitionRule> = new Map();

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.config = STATE_MACHINE_CONFIG;
    this.initializeTransitionRules();
  }

  // =============================================
  // STATE TRANSITION METHODS
  // =============================================

  /**
   * Execute a state transition with validation and logging
   */
  async executeTransition(context: StateTransitionContext): Promise<boolean> {
    try {
      // Validate the transition
      if (!this.isValidTransition(context.fromStatus, context.toStatus)) {
        throw new InvalidStateTransitionError(context.fromStatus, context.toStatus);
      }

      // Get transition rule
      const ruleKey = `${context.fromStatus}->${context.toStatus}`;
      const rule = this.transitionRules.get(ruleKey);

      // Check rule conditions
      if (rule?.condition && !rule.condition(context)) {
        throw new SubscriptionIntentError(
          `Transition condition not met for ${context.fromStatus} -> ${context.toStatus}`,
          'TRANSITION_CONDITION_FAILED',
          { context }
        );
      }

      // Check if reason is required
      if (rule?.requiresReason && !context.reason) {
        throw new SubscriptionIntentError(
          `Reason is required for transition ${context.fromStatus} -> ${context.toStatus}`,
          'REASON_REQUIRED',
          { context }
        );
      }

      // Execute before transition hook
      if (rule?.beforeTransition) {
        await rule.beforeTransition(context);
      }

      // Log the transition
      await this.logTransition(context);

      // Execute after transition hook
      if (rule?.afterTransition) {
        await rule.afterTransition(context);
      }

      return true;
    } catch (error) {
      // Log failed transition attempt
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.logFailedTransition(context, errorMessage);
      throw error;
    }
  }

  /**
   * Check if a transition is valid according to the state machine
   */
  isValidTransition(
    from: SubscriptionIntentStatus,
    to: SubscriptionIntentStatus
  ): boolean {
    const allowedTransitions = this.config.transitions[from] || [];
    return allowedTransitions.includes(to);
  }

  /**
   * Get all possible next states for a given status
   */
  getNextStates(status: SubscriptionIntentStatus): SubscriptionIntentStatus[] {
    return this.config.transitions[status] || [];
  }

  /**
   * Check if a status is a final state
   */
  isFinalState(status: SubscriptionIntentStatus): boolean {
    return this.config.finalStates.includes(status);
  }

  /**
   * Get transition history for a subscription intent
   */
  async getTransitionHistory(intentId: string): Promise<StateTransitionLog[]> {
    try {
      const { data, error } = await this.supabase
        .from('subscription_intent_transitions')
        .select('*')
        .eq('subscription_intent_id', intentId)
        .order('created_at', { ascending: true });

      if (error) {
        throw new SubscriptionIntentError(
          `Failed to get transition history: ${error.message}`,
          'GET_HISTORY_FAILED',
          { intentId }
        );
      }

      return data || [];
    } catch (error) {
      if (error instanceof SubscriptionIntentError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new SubscriptionIntentError(
        `Unexpected error getting transition history: ${errorMessage}`,
        'UNEXPECTED_ERROR',
        { intentId }
      );
    }
  }

  // =============================================
  // TRANSITION RULES INITIALIZATION
  // =============================================

  private initializeTransitionRules(): void {
    // pending -> processing
    this.transitionRules.set('pending->processing', {
      from: 'pending',
      to: 'processing',
      beforeTransition: async (context) => {
        // Validate that payment processing has started
        if (!context.metadata?.iugu_customer_id && !context.metadata?.checkout_url) {
          throw new SubscriptionIntentError(
            'Payment processing requires Iugu customer ID or checkout URL',
            'PAYMENT_DATA_REQUIRED'
          );
        }
      },
      afterTransition: async (context) => {
        // Send notification that payment is being processed
        await this.sendStatusNotification(context, 'payment_processing_started');
      },
    });

    // pending -> failed
    this.transitionRules.set('pending->failed', {
      from: 'pending',
      to: 'failed',
      requiresReason: true,
      afterTransition: async (context) => {
        // Send failure notification
        await this.sendStatusNotification(context, 'payment_failed');
      },
    });

    // pending -> expired
    this.transitionRules.set('pending->expired', {
      from: 'pending',
      to: 'expired',
      afterTransition: async (context) => {
        // Clean up any pending payment data
        await this.cleanupExpiredIntent(context);
      },
    });

    // processing -> completed
    this.transitionRules.set('processing->completed', {
      from: 'processing',
      to: 'completed',
      beforeTransition: async (context) => {
        // Validate that payment was successful
        if (!context.metadata?.iugu_subscription_id) {
          throw new SubscriptionIntentError(
            'Completion requires Iugu subscription ID',
            'SUBSCRIPTION_ID_REQUIRED'
          );
        }
      },
      afterTransition: async (context) => {
        // Send success notification and trigger account creation
        await this.sendStatusNotification(context, 'payment_completed');
        await this.triggerAccountCreation(context);
      },
    });

    // processing -> failed
    this.transitionRules.set('processing->failed', {
      from: 'processing',
      to: 'failed',
      requiresReason: true,
      afterTransition: async (context) => {
        // Send failure notification
        await this.sendStatusNotification(context, 'payment_failed');
      },
    });

    // processing -> expired
    this.transitionRules.set('processing->expired', {
      from: 'processing',
      to: 'expired',
      afterTransition: async (context) => {
        // Clean up processing data
        await this.cleanupExpiredIntent(context);
      },
    });

    // failed -> pending (retry)
    this.transitionRules.set('failed->pending', {
      from: 'failed',
      to: 'pending',
      requiresReason: true,
      afterTransition: async (context) => {
        // Send retry notification
        await this.sendStatusNotification(context, 'payment_retry');
      },
    });

    // failed -> expired
    this.transitionRules.set('failed->expired', {
      from: 'failed',
      to: 'expired',
      afterTransition: async (context) => {
        // Final cleanup
        await this.cleanupExpiredIntent(context);
      },
    });
  }

  // =============================================
  // LOGGING METHODS
  // =============================================

  /**
   * Log a successful state transition
   */
  private async logTransition(context: StateTransitionContext): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('subscription_intent_transitions')
        .insert({
          subscription_intent_id: context.intentId,
          from_status: context.fromStatus,
          to_status: context.toStatus,
          reason: context.reason,
          metadata: context.metadata || {},
          triggered_by: context.triggeredBy,
          created_at: context.timestamp,
        });

      if (error) {
        console.error('Failed to log state transition:', error);
      }
    } catch (error) {
      console.error('Unexpected error logging state transition:', error);
    }
  }

  /**
   * Log a failed state transition attempt
   */
  private async logFailedTransition(
    context: StateTransitionContext,
    errorMessage: string
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('subscription_intent_transitions')
        .insert({
          subscription_intent_id: context.intentId,
          from_status: context.fromStatus,
          to_status: context.toStatus,
          reason: context.reason,
          metadata: {
            ...context.metadata,
            error: errorMessage,
          },
          triggered_by: context.triggeredBy,
          created_at: context.timestamp,
        });

      if (error) {
        console.error('Failed to log failed state transition:', error);
      }
    } catch (error) {
      console.error('Unexpected error logging failed state transition:', error);
    }
  }

  // =============================================
  // TRANSITION HOOKS
  // =============================================

  /**
   * Send status notification
   */
  private async sendStatusNotification(
    context: StateTransitionContext,
    notificationType: string
  ): Promise<void> {
    try {
      // Get intent details for notification
      const { data: intent } = await this.supabase
        .from('subscription_intents')
        .select('user_email, user_name, organization_name')
        .eq('id', context.intentId)
        .single();

      if (!intent) return;

      // Log notification event (actual email sending would be handled by notification service)
      await this.supabase
        .from('webhook_logs')
        .insert({
          event_type: `notification.${notificationType}`,
          payload: {
            intent_id: context.intentId,
            user_email: intent.user_email,
            user_name: intent.user_name,
            organization_name: intent.organization_name,
            from_status: context.fromStatus,
            to_status: context.toStatus,
            reason: context.reason,
          },
          status: 'pending',
        });
    } catch (error) {
      console.error('Failed to send status notification:', error);
    }
  }

  /**
   * Trigger account creation process
   */
  private async triggerAccountCreation(context: StateTransitionContext): Promise<void> {
    try {
      // Log account creation trigger
      await this.supabase
        .from('webhook_logs')
        .insert({
          event_type: 'account.creation_triggered',
          payload: {
            intent_id: context.intentId,
            triggered_by: 'state_machine',
            metadata: context.metadata,
          },
          status: 'pending',
        });
    } catch (error) {
      console.error('Failed to trigger account creation:', error);
    }
  }

  /**
   * Clean up expired intent data
   */
  private async cleanupExpiredIntent(context: StateTransitionContext): Promise<void> {
    try {
      // Log cleanup event
      await this.supabase
        .from('webhook_logs')
        .insert({
          event_type: 'intent.cleanup_triggered',
          payload: {
            intent_id: context.intentId,
            from_status: context.fromStatus,
            cleanup_reason: 'expired',
          },
          status: 'pending',
        });
    } catch (error) {
      console.error('Failed to trigger cleanup:', error);
    }
  }

  // =============================================
  // UTILITY METHODS
  // =============================================

  /**
   * Create state transition context
   */
  createTransitionContext(
    intentId: string,
    fromStatus: SubscriptionIntentStatus,
    toStatus: SubscriptionIntentStatus,
    options: {
      reason?: string;
      metadata?: Record<string, any>;
      triggeredBy?: string;
    } = {}
  ): StateTransitionContext {
    return {
      intentId,
      fromStatus,
      toStatus,
      reason: options.reason,
      metadata: options.metadata,
      triggeredBy: options.triggeredBy,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get state machine configuration
   */
  getConfig(): StateMachineConfig {
    return { ...this.config };
  }

  /**
   * Get all transition rules
   */
  getTransitionRules(): Map<string, StateTransitionRule> {
    return new Map(this.transitionRules);
  }
}

// =============================================
// FACTORY FUNCTION
// =============================================

/**
 * Create a new SubscriptionIntentStateMachine instance
 */
export function createSubscriptionIntentStateMachine(): SubscriptionIntentStateMachine {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase configuration');
  }

  return new SubscriptionIntentStateMachine(supabaseUrl, supabaseKey);
}

// =============================================
// SINGLETON INSTANCE
// =============================================

let stateMachineInstance: SubscriptionIntentStateMachine | null = null;

/**
 * Get singleton instance of SubscriptionIntentStateMachine
 */
export function getSubscriptionIntentStateMachine(): SubscriptionIntentStateMachine {
  if (!stateMachineInstance) {
    stateMachineInstance = createSubscriptionIntentStateMachine();
  }
  return stateMachineInstance;
}