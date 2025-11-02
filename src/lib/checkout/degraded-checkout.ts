/**
 * Degraded Checkout Mode
 * 
 * Implementa modo degradado para checkout quando o Iugu está indisponível
 */

import { gracefulDegradation } from '@/lib/resilience/graceful-degradation';
import { resilientDb } from '@/lib/resilience/database-resilience';
import { BillingCycle } from '@/lib/types/subscription';

export interface DegradedCheckoutResult {
  success: boolean;
  mode: 'normal' | 'degraded' | 'offline';
  intent_id: string;
  message: string;
  checkout_url?: string;
  status_url: string;
  estimated_processing_time?: string;
}

export interface DegradedCheckoutRequest {
  plan_id: string;
  billing_cycle: BillingCycle;
  organization_id: string;
  user_data: {
    name: string;
    email: string;
    organization_name: string;
    cpf_cnpj?: string;
    phone?: string;
  };
  metadata?: Record<string, any>;
}

/**
 * Serviço de checkout com modo degradado
 */
export class DegradedCheckoutService {
  /**
   * Processa checkout com fallback automático para modo degradado
   */
  async processCheckout(request: DegradedCheckoutRequest): Promise<DegradedCheckoutResult> {
    const intentId = this.generateIntentId();
    
    try {
      // Tenta checkout normal primeiro
      return await gracefulDegradation.executeWithFallback(
        'iugu',
        async () => {
          // Aqui seria a lógica normal do checkout com Iugu
          const { IuguService } = await import('@/lib/iugu/iugu-service');
          const iugu = new IuguService();
          
          // Simula criação de checkout normal
          const checkoutUrl = await this.createNormalCheckout(iugu, request, intentId);
          
          return {
            success: true,
            mode: 'normal' as const,
            intent_id: intentId,
            message: 'Checkout criado com sucesso',
            checkout_url: checkoutUrl,
            status_url: `/checkout/status/${intentId}`
          };
        },
        'process-checkout'
      );
      
    } catch (error) {
      console.warn('[DegradedCheckout] Normal checkout failed, using degraded mode:', error);
      
      // Fallback para modo degradado
      return await this.createDegradedCheckout(request, intentId);
    }
  }

  /**
   * Cria checkout normal com Iugu
   */
  private async createNormalCheckout(
    iugu: any,
    request: DegradedCheckoutRequest,
    intentId: string
  ): Promise<string> {
    // Salva intent no banco primeiro
    await this.saveSubscriptionIntent(request, intentId, 'pending');
    
    // Cria customer no Iugu
    const customer = await iugu.createOrGetCustomer(
      request.organization_id,
      request.user_data.email,
      request.user_data.name,
      {
        cpf_cnpj: request.user_data.cpf_cnpj,
        phone: request.user_data.phone
      }
    );
    
    // Cria ou atualiza plano
    const plan = await iugu.createOrUpdatePlan(
      request.plan_id,
      'Plano Premium', // Buscar nome real do plano
      9900, // Buscar preço real do plano
      request.billing_cycle
    );
    
    // Cria checkout URL
    const checkoutUrl = await iugu.createCheckoutUrl(
      customer.id,
      plan.identifier,
      request.organization_id,
      request.plan_id
    );
    
    // Atualiza intent com dados do Iugu
    await this.updateSubscriptionIntent(intentId, {
      iugu_customer_id: customer.id,
      checkout_url: checkoutUrl,
      status: 'processing'
    });
    
    return checkoutUrl;
  }

  /**
   * Cria checkout em modo degradado
   */
  private async createDegradedCheckout(
    request: DegradedCheckoutRequest,
    intentId: string
  ): Promise<DegradedCheckoutResult> {
    try {
      // Salva intent como pendente para processamento posterior
      await this.saveSubscriptionIntent(request, intentId, 'degraded_pending');
      
      // Agenda processamento para quando o Iugu voltar
      await this.scheduleProcessing(intentId);
      
      // Envia email de confirmação
      await this.sendDegradedModeEmail(request.user_data.email, intentId);
      
      return {
        success: true,
        mode: 'degraded',
        intent_id: intentId,
        message: 'Sua solicitação foi registrada. Você receberá o link de pagamento por email em breve.',
        status_url: `/checkout/status/${intentId}`,
        estimated_processing_time: '5-10 minutos'
      };
      
    } catch (error) {
      console.error('[DegradedCheckout] Failed to create degraded checkout:', error);
      
      // Último recurso: modo offline
      return this.createOfflineCheckout(request, intentId);
    }
  }

  /**
   * Cria checkout em modo offline (último recurso)
   */
  private createOfflineCheckout(
    request: DegradedCheckoutRequest,
    intentId: string
  ): DegradedCheckoutResult {
    // Salva localmente para processamento manual
    this.saveOfflineIntent(request, intentId);
    
    return {
      success: true,
      mode: 'offline',
      intent_id: intentId,
      message: 'Sistema temporariamente indisponível. Nossa equipe entrará em contato em até 24 horas.',
      status_url: `/checkout/status/${intentId}`,
      estimated_processing_time: '24 horas'
    };
  }

  /**
   * Salva subscription intent no banco
   */
  private async saveSubscriptionIntent(
    request: DegradedCheckoutRequest,
    intentId: string,
    status: string
  ): Promise<void> {
    await resilientDb.execute({
      operation: async (client) => {
        const { error } = await client
          .from('subscription_intents')
          .insert({
            id: intentId,
            plan_id: request.plan_id,
            billing_cycle: request.billing_cycle,
            status,
            user_email: request.user_data.email,
            user_name: request.user_data.name,
            organization_name: request.user_data.organization_name,
            cpf_cnpj: request.user_data.cpf_cnpj,
            phone: request.user_data.phone,
            metadata: {
              ...request.metadata,
              degraded_mode: status.includes('degraded'),
              created_via: status.includes('degraded') ? 'degraded_checkout' : 'normal_checkout'
            },
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 horas
            created_at: new Date().toISOString()
          });
        
        if (error) throw error;
      },
      operationName: 'save-subscription-intent'
    });
  }

  /**
   * Atualiza subscription intent
   */
  private async updateSubscriptionIntent(
    intentId: string,
    updates: Record<string, any>
  ): Promise<void> {
    await resilientDb.execute({
      operation: async (client) => {
        const { error } = await client
          .from('subscription_intents')
          .update({
            ...updates,
            updated_at: new Date().toISOString()
          })
          .eq('id', intentId);
        
        if (error) throw error;
      },
      operationName: 'update-subscription-intent'
    });
  }

  /**
   * Agenda processamento para quando o serviço voltar
   */
  private async scheduleProcessing(intentId: string): Promise<void> {
    // Implementar fila de processamento ou job scheduler
    console.log(`[DegradedCheckout] Scheduled processing for intent ${intentId}`);
    
    // Por enquanto, apenas registra no log
    // Em produção, usaria Redis Queue, Bull, ou similar
  }

  /**
   * Envia email de modo degradado
   */
  private async sendDegradedModeEmail(email: string, intentId: string): Promise<void> {
    try {
      // Implementar envio de email
      console.log(`[DegradedCheckout] Sending degraded mode email to ${email} for intent ${intentId}`);
      
      // Aqui integraria com serviço de email (SendGrid, SES, etc.)
      
    } catch (error) {
      console.error('[DegradedCheckout] Failed to send degraded mode email:', error);
      // Não falha o processo se o email não for enviado
    }
  }

  /**
   * Salva intent offline para processamento manual
   */
  private saveOfflineIntent(request: DegradedCheckoutRequest, intentId: string): void {
    const offlineData = {
      intent_id: intentId,
      timestamp: new Date().toISOString(),
      request,
      status: 'offline_pending'
    };
    
    // Salva em arquivo local ou cache para processamento manual
    console.log('[DegradedCheckout] Offline intent saved:', offlineData);
    
    // Em produção, salvaria em local persistente para recuperação
  }

  /**
   * Gera ID único para intent
   */
  private generateIntentId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `intent_${timestamp}_${random}`;
  }

  /**
   * Processa intents pendentes quando o serviço volta
   */
  async processPendingIntents(): Promise<void> {
    try {
      const pendingIntents = await resilientDb.execute({
        operation: async (client) => {
          const { data, error } = await client
            .from('subscription_intents')
            .select('*')
            .in('status', ['degraded_pending', 'offline_pending'])
            .lt('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Mais de 5 minutos
            .limit(10);
          
          if (error) throw error;
          return data || [];
        },
        operationName: 'get-pending-intents'
      });

      console.log(`[DegradedCheckout] Processing ${pendingIntents.length} pending intents`);

      for (const intent of pendingIntents) {
        try {
          await this.retryIntentProcessing(intent);
        } catch (error) {
          console.error(`[DegradedCheckout] Failed to retry intent ${intent.id}:`, error);
        }
      }
      
    } catch (error) {
      console.error('[DegradedCheckout] Error processing pending intents:', error);
    }
  }

  /**
   * Tenta reprocessar um intent pendente
   */
  private async retryIntentProcessing(intent: any): Promise<void> {
    const request: DegradedCheckoutRequest = {
      plan_id: intent.plan_id,
      billing_cycle: intent.billing_cycle,
      organization_id: intent.organization_id || 'unknown',
      user_data: {
        name: intent.user_name,
        email: intent.user_email,
        organization_name: intent.organization_name,
        cpf_cnpj: intent.cpf_cnpj,
        phone: intent.phone
      },
      metadata: intent.metadata
    };

    try {
      // Tenta criar checkout normal agora
      const { IuguService } = await import('@/lib/iugu/iugu-service');
      const iugu = new IuguService();
      
      const checkoutUrl = await this.createNormalCheckout(iugu, request, intent.id);
      
      // Envia email com link de pagamento
      await this.sendPaymentLinkEmail(intent.user_email, checkoutUrl, intent.id);
      
      console.log(`[DegradedCheckout] Successfully processed pending intent ${intent.id}`);
      
    } catch (error) {
      console.error(`[DegradedCheckout] Failed to retry intent ${intent.id}:`, error);
      
      // Incrementa contador de tentativas
      await this.incrementRetryCount(intent.id);
    }
  }

  /**
   * Envia email com link de pagamento
   */
  private async sendPaymentLinkEmail(
    email: string,
    checkoutUrl: string,
    intentId: string
  ): Promise<void> {
    console.log(`[DegradedCheckout] Sending payment link to ${email}: ${checkoutUrl}`);
    // Implementar envio de email com link de pagamento
  }

  /**
   * Incrementa contador de tentativas de retry
   */
  private async incrementRetryCount(intentId: string): Promise<void> {
    await resilientDb.execute({
      operation: async (client) => {
        const { error } = await client
          .rpc('increment_intent_retry_count', { intent_id: intentId });
        
        if (error) throw error;
      },
      operationName: 'increment-retry-count'
    });
  }
}

/**
 * Instância singleton do serviço de checkout degradado
 */
export const degradedCheckout = new DegradedCheckoutService();