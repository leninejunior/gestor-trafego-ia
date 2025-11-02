/**
 * Subscription Intent Service
 * 
 * Core service for managing subscription intents throughout the checkout process.
 * Implements CRUD operations, state management, validation, and caching.
 * 
 * Requirements: 1.3, 2.1
 */

import { createClient } from '@supabase/supabase-js';
import {
  SubscriptionIntent,
  SubscriptionIntentWithPlan,
  CreateSubscriptionIntentRequest,
  CreateSubscriptionIntentResponse,
  UpdateSubscriptionIntentRequest,
  SubscriptionIntentStatus,
  SubscriptionIntentFilters,
  SubscriptionIntentSearchParams,
  SubscriptionIntentSearchResult,
  SubscriptionIntentMetrics,
  ValidationResult,
  ValidationError,
  SubscriptionIntentError,
  SubscriptionIntentValidationError,
  SubscriptionIntentNotFoundError,
  InvalidStateTransitionError,
  STATE_MACHINE_CONFIG,
  DEFAULT_EXPIRATION_DAYS,
  BillingCycle,
  SubscriptionIntentServiceConfig,
  CachedSubscriptionIntent,
} from '@/lib/types/subscription-intent';
import { 
  SubscriptionIntentStateMachine,
  createSubscriptionIntentStateMachine,
} from './subscription-intent-state-machine';

/**
 * Core service for managing subscription intents
 */
export class SubscriptionIntentService {
  private supabase;
  private cache: Map<string, CachedSubscriptionIntent> = new Map();
  private config: SubscriptionIntentServiceConfig;
  private stateMachine: SubscriptionIntentStateMachine;

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    config?: Partial<SubscriptionIntentServiceConfig>
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.stateMachine = new SubscriptionIntentStateMachine(supabaseUrl, supabaseKey);
    this.config = {
      cache: {
        ttl: 300, // 5 minutes
        keyPrefix: 'subscription_intent:',
      },
      expiration: {
        defaultDays: DEFAULT_EXPIRATION_DAYS,
        maxDays: 30,
      },
      validation: {
        emailRegex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        phoneRegex: /^[\+]?[1-9][\d]{0,15}$/,
        cpfCnpjRegex: /^[\d]{11}$|^[\d]{14}$/,
      },
      cleanup: {
        batchSize: 100,
        intervalMinutes: 60,
      },
      ...config,
    };
  }

  // =============================================
  // CRUD OPERATIONS
  // =============================================

  /**
   * Create a new subscription intent
   */
  async createIntent(
    request: CreateSubscriptionIntentRequest
  ): Promise<CreateSubscriptionIntentResponse> {
    try {
      // Validate input
      const validation = this.validateCreateRequest(request);
      if (!validation.isValid) {
        throw new SubscriptionIntentValidationError(
          `Validation failed: ${validation.errors.map(e => e.message).join(', ')}`,
          validation.errors[0]?.field || 'unknown'
        );
      }

      // Check if plan exists and is active
      const { data: plan, error: planError } = await this.supabase
        .from('subscription_plans')
        .select('id, name, monthly_price, annual_price, is_active')
        .eq('id', request.plan_id)
        .eq('is_active', true)
        .single();

      if (planError || !plan) {
        throw new SubscriptionIntentError(
          'Invalid or inactive subscription plan',
          'INVALID_PLAN',
          { plan_id: request.plan_id }
        );
      }

      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + this.config.expiration.defaultDays);

      // Create the intent using the database function
      const { data, error } = await this.supabase
        .rpc('create_subscription_intent', {
          plan_id_param: request.plan_id,
          billing_cycle_param: request.billing_cycle,
          user_email_param: request.user_email.toLowerCase().trim(),
          user_name_param: request.user_name.trim(),
          organization_name_param: request.organization_name.trim(),
          cpf_cnpj_param: request.cpf_cnpj?.replace(/\D/g, '') || null,
          phone_param: request.phone?.replace(/\D/g, '') || null,
          metadata_param: request.metadata || {},
        });

      if (error) {
        throw new SubscriptionIntentError(
          `Failed to create subscription intent: ${error.message}`,
          'CREATE_FAILED',
          { error: error.message }
        );
      }

      const intentId = data as string;

      // Generate status URL
      const statusUrl = `${process.env.NEXT_PUBLIC_APP_URL}/checkout/status/${intentId}`;

      // Clear cache for this email (in case of previous intents)
      this.clearCacheByEmail(request.user_email);

      return {
        success: true,
        intent_id: intentId,
        status_url: statusUrl,
        expires_at: expiresAt.toISOString(),
      };
    } catch (error) {
      if (error instanceof SubscriptionIntentError) {
        throw error;
      }
      throw new SubscriptionIntentError(
        `Unexpected error creating subscription intent: ${error.message}`,
        'UNEXPECTED_ERROR',
        { originalError: error.message }
      );
    }
  }

  /**
   * Get subscription intent by ID
   */
  async getIntent(intentId: string): Promise<SubscriptionIntentWithPlan> {
    try {
      // Check cache first
      const cached = this.getCachedIntent(intentId);
      if (cached) {
        // Get plan data for cached intent
        const { data: plan } = await this.supabase
          .from('subscription_plans')
          .select('id, name, description, monthly_price, annual_price, features')
          .eq('id', cached.data.plan_id)
          .single();

        return {
          ...cached.data,
          plan: plan || {
            id: cached.data.plan_id,
            name: 'Unknown Plan',
            monthly_price: 0,
            annual_price: 0,
            features: {},
          },
        };
      }

      // Fetch from database with plan data
      const { data, error } = await this.supabase
        .from('subscription_intents')
        .select(`
          *,
          plan:subscription_plans(
            id,
            name,
            description,
            monthly_price,
            annual_price,
            features
          )
        `)
        .eq('id', intentId)
        .single();

      if (error || !data) {
        throw new SubscriptionIntentNotFoundError(intentId);
      }

      const intent = this.mapDatabaseToIntent(data);
      
      // Cache the result
      this.setCachedIntent(intentId, intent);

      return {
        ...intent,
        plan: data.plan || {
          id: intent.plan_id,
          name: 'Unknown Plan',
          monthly_price: 0,
          annual_price: 0,
          features: {},
        },
      };
    } catch (error) {
      if (error instanceof SubscriptionIntentError) {
        throw error;
      }
      throw new SubscriptionIntentError(
        `Failed to get subscription intent: ${error.message}`,
        'GET_FAILED',
        { intentId }
      );
    }
  }

  /**
   * Update subscription intent with state machine validation
   */
  async updateIntent(
    intentId: string,
    updates: UpdateSubscriptionIntentRequest,
    options: {
      reason?: string;
      triggeredBy?: string;
    } = {}
  ): Promise<SubscriptionIntent> {
    try {
      // Get current intent to validate state transitions
      const currentIntent = await this.getIntent(intentId);

      // Handle status updates through state machine
      if (updates.status && updates.status !== currentIntent.status) {
        // Create transition context
        const transitionContext = this.stateMachine.createTransitionContext(
          intentId,
          currentIntent.status,
          updates.status,
          {
            reason: options.reason,
            metadata: updates.metadata,
            triggeredBy: options.triggeredBy,
          }
        );

        // Execute state transition through state machine
        await this.stateMachine.executeTransition(transitionContext);

        // Update the database using the function
        const { error } = await this.supabase
          .rpc('update_subscription_intent_status', {
            intent_id_param: intentId,
            new_status_param: updates.status,
            iugu_customer_id_param: updates.iugu_customer_id || null,
            iugu_subscription_id_param: updates.iugu_subscription_id || null,
            user_id_param: updates.user_id || null,
            metadata_update_param: updates.metadata || null,
          });

        if (error) {
          throw new SubscriptionIntentError(
            `Failed to update subscription intent status: ${error.message}`,
            'UPDATE_FAILED',
            { intentId, updates }
          );
        }
      } else {
        // For non-status updates, use direct table update
        const updateData: any = {};
        if (updates.checkout_url !== undefined) updateData.checkout_url = updates.checkout_url;
        if (updates.iugu_customer_id !== undefined) updateData.iugu_customer_id = updates.iugu_customer_id;
        if (updates.iugu_subscription_id !== undefined) updateData.iugu_subscription_id = updates.iugu_subscription_id;
        if (updates.user_id !== undefined) updateData.user_id = updates.user_id;
        if (updates.metadata !== undefined) updateData.metadata = updates.metadata;

        if (Object.keys(updateData).length > 0) {
          updateData.updated_at = new Date().toISOString();

          const { error } = await this.supabase
            .from('subscription_intents')
            .update(updateData)
            .eq('id', intentId);

          if (error) {
            throw new SubscriptionIntentError(
              `Failed to update subscription intent: ${error.message}`,
              'UPDATE_FAILED',
              { intentId, updates }
            );
          }
        }
      }

      // Clear cache and return updated intent
      this.clearCache(intentId);
      return await this.getIntent(intentId);
    } catch (error) {
      if (error instanceof SubscriptionIntentError) {
        throw error;
      }
      throw new SubscriptionIntentError(
        `Unexpected error updating subscription intent: ${error.message}`,
        'UNEXPECTED_ERROR',
        { intentId, updates }
      );
    }
  }

  /**
   * Delete subscription intent (soft delete by marking as expired)
   */
  async deleteIntent(intentId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .rpc('update_subscription_intent_status', {
          intent_id_param: intentId,
          new_status_param: 'expired',
        });

      if (error) {
        throw new SubscriptionIntentError(
          `Failed to delete subscription intent: ${error.message}`,
          'DELETE_FAILED',
          { intentId }
        );
      }

      this.clearCache(intentId);
      return true;
    } catch (error) {
      if (error instanceof SubscriptionIntentError) {
        throw error;
      }
      throw new SubscriptionIntentError(
        `Unexpected error deleting subscription intent: ${error.message}`,
        'UNEXPECTED_ERROR',
        { intentId }
      );
    }
  }

  // =============================================
  // SEARCH AND FILTERING
  // =============================================

  /**
   * Search subscription intents with filters and pagination
   */
  async searchIntents(
    params: SubscriptionIntentSearchParams = {}
  ): Promise<SubscriptionIntentSearchResult> {
    try {
      let query = this.supabase
        .from('subscription_intents')
        .select(`
          *,
          plan:subscription_plans(
            id,
            name,
            description,
            monthly_price,
            annual_price,
            features
          )
        `, { count: 'exact' });

      // Apply filters
      if (params.filters) {
        query = this.applyFilters(query, params.filters);
      }

      // Apply sorting
      if (params.sort) {
        query = query.order(params.sort.field, { ascending: params.sort.direction === 'asc' });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      // Apply pagination
      const page = params.pagination?.page || 1;
      const limit = params.pagination?.limit || 50;
      const offset = (page - 1) * limit;

      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        throw new SubscriptionIntentError(
          `Failed to search subscription intents: ${error.message}`,
          'SEARCH_FAILED',
          { params }
        );
      }

      const intents = (data || []).map(item => ({
        ...this.mapDatabaseToIntent(item),
        plan: item.plan || {
          id: item.plan_id,
          name: 'Unknown Plan',
          monthly_price: 0,
          annual_price: 0,
          features: {},
        },
      }));

      return {
        intents,
        total: count || 0,
        page,
        limit,
        hasMore: (count || 0) > offset + limit,
      };
    } catch (error) {
      if (error instanceof SubscriptionIntentError) {
        throw error;
      }
      throw new SubscriptionIntentError(
        `Unexpected error searching subscription intents: ${error.message}`,
        'UNEXPECTED_ERROR',
        { params }
      );
    }
  }

  /**
   * Get subscription intent by email and optional CPF
   */
  async getIntentByIdentifier(
    email: string,
    cpf?: string
  ): Promise<SubscriptionIntentWithPlan | null> {
    try {
      const { data, error } = await this.supabase
        .rpc('get_subscription_intent_by_identifier', {
          email_param: email.toLowerCase().trim(),
          cpf_param: cpf?.replace(/\D/g, '') || null,
        });

      if (error) {
        throw new SubscriptionIntentError(
          `Failed to get subscription intent by identifier: ${error.message}`,
          'GET_BY_IDENTIFIER_FAILED',
          { email, cpf }
        );
      }

      if (!data || data.length === 0) {
        return null;
      }

      const intentData = data[0];
      
      // Get full intent data
      return await this.getIntent(intentData.id);
    } catch (error) {
      if (error instanceof SubscriptionIntentError) {
        throw error;
      }
      throw new SubscriptionIntentError(
        `Unexpected error getting subscription intent by identifier: ${error.message}`,
        'UNEXPECTED_ERROR',
        { email, cpf }
      );
    }
  }

  // =============================================
  // STATE MANAGEMENT
  // =============================================

  /**
   * Check if a state transition is valid
   */
  isValidStateTransition(
    from: SubscriptionIntentStatus,
    to: SubscriptionIntentStatus
  ): boolean {
    return this.stateMachine.isValidTransition(from, to);
  }

  /**
   * Get all possible next states for a given status
   */
  getNextStates(status: SubscriptionIntentStatus): SubscriptionIntentStatus[] {
    return this.stateMachine.getNextStates(status);
  }

  /**
   * Check if a status is a final state
   */
  isFinalState(status: SubscriptionIntentStatus): boolean {
    return this.stateMachine.isFinalState(status);
  }

  /**
   * Get transition history for a subscription intent
   */
  async getTransitionHistory(intentId: string) {
    return await this.stateMachine.getTransitionHistory(intentId);
  }

  /**
   * Execute a state transition with full validation and logging
   */
  async executeStateTransition(
    intentId: string,
    toStatus: SubscriptionIntentStatus,
    options: {
      reason?: string;
      metadata?: Record<string, any>;
      triggeredBy?: string;
    } = {}
  ): Promise<SubscriptionIntent> {
    const currentIntent = await this.getIntent(intentId);
    
    return await this.updateIntent(
      intentId,
      { 
        status: toStatus,
        metadata: options.metadata,
      },
      {
        reason: options.reason,
        triggeredBy: options.triggeredBy,
      }
    );
  }

  // =============================================
  // VALIDATION
  // =============================================

  /**
   * Validate create subscription intent request
   */
  private validateCreateRequest(request: CreateSubscriptionIntentRequest): ValidationResult {
    const errors: ValidationError[] = [];

    // Validate required fields
    if (!request.plan_id) {
      errors.push({
        field: 'plan_id',
        message: 'Plan ID is required',
        code: 'REQUIRED',
      });
    }

    if (!request.billing_cycle || !['monthly', 'annual'].includes(request.billing_cycle)) {
      errors.push({
        field: 'billing_cycle',
        message: 'Billing cycle must be monthly or annual',
        code: 'INVALID_VALUE',
      });
    }

    if (!request.user_email) {
      errors.push({
        field: 'user_email',
        message: 'Email is required',
        code: 'REQUIRED',
      });
    } else if (!this.config.validation.emailRegex.test(request.user_email)) {
      errors.push({
        field: 'user_email',
        message: 'Invalid email format',
        code: 'INVALID_FORMAT',
      });
    }

    if (!request.user_name || request.user_name.trim().length < 2) {
      errors.push({
        field: 'user_name',
        message: 'User name must be at least 2 characters',
        code: 'INVALID_LENGTH',
      });
    }

    if (!request.organization_name || request.organization_name.trim().length < 2) {
      errors.push({
        field: 'organization_name',
        message: 'Organization name must be at least 2 characters',
        code: 'INVALID_LENGTH',
      });
    }

    // Validate optional fields
    if (request.phone && this.config.validation.phoneRegex && !this.config.validation.phoneRegex.test(request.phone.replace(/\D/g, ''))) {
      errors.push({
        field: 'phone',
        message: 'Invalid phone format',
        code: 'INVALID_FORMAT',
      });
    }

    if (request.cpf_cnpj && this.config.validation.cpfCnpjRegex && !this.config.validation.cpfCnpjRegex.test(request.cpf_cnpj.replace(/\D/g, ''))) {
      errors.push({
        field: 'cpf_cnpj',
        message: 'Invalid CPF/CNPJ format',
        code: 'INVALID_FORMAT',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // =============================================
  // CACHE MANAGEMENT
  // =============================================

  /**
   * Get cached subscription intent
   */
  private getCachedIntent(intentId: string): SubscriptionIntent | null {
    const key = this.config.cache.keyPrefix + intentId;
    const cached = this.cache.get(key);
    
    if (!cached) {
      return null;
    }

    // Check if cache is expired
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Set cached subscription intent
   */
  private setCachedIntent(intentId: string, intent: SubscriptionIntent): void {
    const key = this.config.cache.keyPrefix + intentId;
    const expiresAt = Date.now() + (this.config.cache.ttl * 1000);
    
    this.cache.set(key, {
      data: intent,
      cachedAt: Date.now(),
      expiresAt,
    });
  }

  /**
   * Clear cache for specific intent
   */
  private clearCache(intentId: string): void {
    const key = this.config.cache.keyPrefix + intentId;
    this.cache.delete(key);
  }

  /**
   * Clear cache by email (for when new intents are created)
   */
  private clearCacheByEmail(email: string): void {
    // Since we don't have email-based cache keys, we'll clear all cache
    // In a production system, you might want to implement more sophisticated cache invalidation
    this.cache.clear();
  }

  // =============================================
  // UTILITY METHODS
  // =============================================

  /**
   * Apply filters to query
   */
  private applyFilters(query: any, filters: SubscriptionIntentFilters): any {
    if (filters.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    }

    if (filters.plan_id) {
      query = query.eq('plan_id', filters.plan_id);
    }

    if (filters.user_email) {
      query = query.ilike('user_email', `%${filters.user_email}%`);
    }

    if (filters.created_after) {
      query = query.gte('created_at', filters.created_after);
    }

    if (filters.created_before) {
      query = query.lte('created_at', filters.created_before);
    }

    if (filters.expires_after) {
      query = query.gte('expires_at', filters.expires_after);
    }

    if (filters.expires_before) {
      query = query.lte('expires_at', filters.expires_before);
    }

    return query;
  }

  /**
   * Map database row to SubscriptionIntent type
   */
  private mapDatabaseToIntent(data: any): SubscriptionIntent {
    return {
      id: data.id,
      plan_id: data.plan_id,
      billing_cycle: data.billing_cycle as BillingCycle,
      status: data.status as SubscriptionIntentStatus,
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
}

// =============================================
// FACTORY FUNCTION
// =============================================

/**
 * Create a new SubscriptionIntentService instance
 */
export function createSubscriptionIntentService(
  config?: Partial<SubscriptionIntentServiceConfig>
): SubscriptionIntentService {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase configuration');
  }

  return new SubscriptionIntentService(supabaseUrl, supabaseKey, config);
}

// =============================================
// SINGLETON INSTANCE
// =============================================

let subscriptionIntentServiceInstance: SubscriptionIntentService | null = null;

/**
 * Get singleton instance of SubscriptionIntentService
 */
export function getSubscriptionIntentService(): SubscriptionIntentService {
  if (!subscriptionIntentServiceInstance) {
    subscriptionIntentServiceInstance = createSubscriptionIntentService();
  }
  return subscriptionIntentServiceInstance;
}