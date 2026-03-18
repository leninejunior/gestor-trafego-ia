/**
 * Database Resilience Layer
 * 
 * Adiciona circuit breaker e retry logic para operações de banco de dados
 */

import { createClient } from '@/lib/supabase/server';
import { CircuitBreakerFactory } from './circuit-breaker';
import { RetryManager } from './retry-manager';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface DatabaseOperation<T> {
  operation: (client: SupabaseClient) => Promise<T>;
  operationName?: string;
  useCircuitBreaker?: boolean;
  useRetry?: boolean;
}

export interface DatabaseFallbackData {
  timestamp: Date;
  operation: string;
  data: any;
  organizationId?: string;
}

/**
 * Wrapper resiliente para operações de banco de dados
 */
export class ResilientDatabase {
  private circuitBreaker = CircuitBreakerFactory.getDatabaseCircuitBreaker();
  private retryManager = RetryManager.forDatabase();
  private fallbackCache = new Map<string, DatabaseFallbackData>();

  /**
   * Executa operação de banco com resiliência
   */
  async execute<T>(config: DatabaseOperation<T>): Promise<T> {
    const { operation, operationName = 'database-operation', useCircuitBreaker = true, useRetry = true } = config;

    try {
      if (useCircuitBreaker && useRetry) {
        return await this.circuitBreaker.execute(async () => {
          return await this.retryManager.execute(async () => {
            const client = await createClient();
            return await operation(client);
          }, operationName);
        });
      } else if (useCircuitBreaker) {
        return await this.circuitBreaker.execute(async () => {
          const client = await createClient();
          return await operation(client);
        });
      } else if (useRetry) {
        return await this.retryManager.execute(async () => {
          const client = await createClient();
          return await operation(client);
        }, operationName);
      } else {
        const client = await createClient();
        return await operation(client);
      }
    } catch (error) {
      console.error(`[Database] Operation '${operationName}' failed:`, error);
      throw error;
    }
  }

  /**
   * Executa operação com fallback para cache local
   */
  async executeWithFallback<T>(
    config: DatabaseOperation<T>,
    fallbackKey: string,
    fallbackValue?: T
  ): Promise<T> {
    try {
      const result = await this.execute(config);
      
      // Remove do cache de fallback se a operação foi bem-sucedida
      this.fallbackCache.delete(fallbackKey);
      
      return result;
    } catch (error) {
      console.warn(`[Database] Using fallback for '${config.operationName}':`, error);
      
      // Tenta usar valor de fallback fornecido
      if (fallbackValue !== undefined) {
        return fallbackValue;
      }
      
      // Tenta usar cache de fallback
      const cached = this.fallbackCache.get(fallbackKey);
      if (cached) {
        console.log(`[Database] Using cached fallback data for '${fallbackKey}'`);
        return cached.data as T;
      }
      
      // Se não tem fallback, relança o erro
      throw error;
    }
  }

  /**
   * Salva dados no cache de fallback
   */
  cacheFallbackData(key: string, data: any, organizationId?: string): void {
    this.fallbackCache.set(key, {
      timestamp: new Date(),
      operation: key,
      data,
      organizationId
    });
  }

  /**
   * Limpa cache de fallback antigo
   */
  cleanupFallbackCache(maxAge: number = 3600000): void { // 1 hora por padrão
    const now = Date.now();
    
    for (const [key, value] of this.fallbackCache.entries()) {
      if (now - value.timestamp.getTime() > maxAge) {
        this.fallbackCache.delete(key);
      }
    }
  }

  /**
   * Verifica se o banco está saudável
   */
  async healthCheck(): Promise<boolean> {
    try {
      return await this.execute({
        operation: async (client) => {
          const { error } = await client.from('subscription_plans').select('id').limit(1);
          return !error;
        },
        operationName: 'health-check',
        useRetry: false
      });
    } catch (error) {
      console.error('[Database] Health check failed:', error);
      return false;
    }
  }

  /**
   * Obtém métricas do circuit breaker
   */
  getMetrics() {
    return this.circuitBreaker.getMetrics();
  }

  /**
   * Força reset do circuit breaker (para testes ou recuperação manual)
   */
  reset(): void {
    this.circuitBreaker.reset();
    this.fallbackCache.clear();
  }
}

/**
 * Instância singleton do database resiliente
 */
export const resilientDb = new ResilientDatabase();

/**
 * Helper functions para operações comuns
 */
export class DatabaseHelpers {
  /**
   * Busca subscription intent com fallback
   */
  static async getSubscriptionIntent(intentId: string) {
    return resilientDb.executeWithFallback({
      operation: async (client) => {
        const { data, error } = await client
          .from('subscription_intents')
          .select('*')
          .eq('id', intentId)
          .single();
        
        if (error) throw error;
        return data;
      },
      operationName: 'get-subscription-intent'
    }, `subscription-intent-${intentId}`);
  }

  /**
   * Atualiza status de subscription intent com retry
   */
  static async updateSubscriptionIntentStatus(
    intentId: string, 
    status: string, 
    metadata?: any
  ) {
    return resilientDb.execute({
      operation: async (client) => {
        const updateData: any = { 
          status,
          updated_at: new Date().toISOString()
        };
        
        if (metadata) {
          updateData.metadata = metadata;
        }
        
        if (status === 'completed') {
          updateData.completed_at = new Date().toISOString();
        }

        const { data, error } = await client
          .from('subscription_intents')
          .update(updateData)
          .eq('id', intentId)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      },
      operationName: 'update-subscription-intent-status'
    });
  }

  /**
   * Cria log de webhook com retry
   */
  static async createWebhookLog(logData: {
    event_type: string;
    event_id?: string;
    subscription_intent_id?: string;
    payload: any;
    status?: string;
    error_message?: string;
  }) {
    return resilientDb.execute({
      operation: async (client) => {
        const { data, error } = await client
          .from('webhook_logs')
          .insert({
            ...logData,
            created_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (error) throw error;
        return data;
      },
      operationName: 'create-webhook-log'
    });
  }

  /**
   * Busca plano de assinatura com cache
   */
  static async getSubscriptionPlan(planId: string) {
    return resilientDb.executeWithFallback({
      operation: async (client) => {
        const { data, error } = await client
          .from('subscription_plans')
          .select('*')
          .eq('id', planId)
          .single();
        
        if (error) throw error;
        return data;
      },
      operationName: 'get-subscription-plan'
    }, `subscription-plan-${planId}`);
  }

  /**
   * Verifica feature gate com fallback
   */
  static async checkFeatureAccess(
    organizationId: string, 
    feature: string,
    fallbackValue: boolean = false
  ) {
    return resilientDb.executeWithFallback({
      operation: async (client) => {
        // Implementar lógica de verificação de feature
        const { data, error } = await client
          .from('organizations')
          .select('subscription_id, subscriptions(plan_id, status, subscription_plans(features))')
          .eq('id', organizationId)
          .single();
        
        if (error) throw error;
        
        // Lógica de verificação de feature baseada no plano
        return data?.subscriptions?.subscription_plans?.features?.[feature] || false;
      },
      operationName: 'check-feature-access'
    }, `feature-${organizationId}-${feature}`, fallbackValue);
  }
}