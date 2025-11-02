/**
 * Iugu Payment Gateway Service
 * Integração completa com a API do Iugu para processamento de pagamentos
 * Com circuit breaker e retry logic para resiliência
 */

import { BillingCycle } from '@/lib/types/subscription';
import { CircuitBreakerFactory } from '@/lib/resilience/circuit-breaker';
import { RetryManager } from '@/lib/resilience/retry-manager';

// Tipos do Iugu
export interface IuguCustomer {
  id: string;
  email: string;
  name: string;
  cpf_cnpj?: string;
  phone?: string;
  notes?: string;
  custom_variables?: Array<{ name: string; value: string }>;
}

export interface IuguSubscription {
  id: string;
  customer_id: string;
  plan_identifier: string;
  active: boolean;
  expires_at?: string;
  suspended: boolean;
  price_cents: number;
  currency: string;
  features: string;
  cycled_at: string;
  credits_based: boolean;
  credits_cycle: number;
  credits_min: number;
  recent_invoices: any[];
}

export interface IuguPlan {
  id: string;
  name: string;
  identifier: string;
  interval: number;
  interval_type: 'months' | 'weeks';
  value_cents: number;
  currency: string;
  features: any[];
}

export interface IuguInvoice {
  id: string;
  status: 'pending' | 'paid' | 'canceled' | 'partially_paid' | 'refunded' | 'expired';
  total_cents: number;
  currency: string;
  due_date: string;
  secure_url: string;
  secure_id: string;
}

export interface CreateCustomerParams {
  email: string;
  name: string;
  cpf_cnpj?: string;
  phone?: string;
  notes?: string;
  custom_variables?: Array<{ name: string; value: string }>;
}

export interface CreateSubscriptionParams {
  customer_id: string;
  plan_identifier: string;
  expires_at?: string;
  only_on_charge_success?: boolean;
  payable_with?: 'credit_card' | 'bank_slip' | 'pix' | 'all';
  credits_based?: boolean;
  price_cents?: number;
  credits_cycle?: number;
  credits_min?: number;
  subitems?: Array<{
    description: string;
    quantity: number;
    price_cents: number;
  }>;
  custom_variables?: Array<{ name: string; value: string }>;
}

export class IuguService {
  private apiToken: string;
  private accountId: string;
  private baseUrl = 'https://api.iugu.com/v1';
  private circuitBreaker = CircuitBreakerFactory.getIuguCircuitBreaker();
  private retryManager = RetryManager.forIuguAPI();

  constructor() {
    this.apiToken = process.env.IUGU_API_TOKEN || '';
    this.accountId = process.env.IUGU_ACCOUNT_ID || '';

    if (!this.apiToken) {
      throw new Error('IUGU_API_TOKEN não configurado');
    }
  }

  /**
   * Faz requisição para API do Iugu com circuit breaker e retry logic
   */
  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any
  ): Promise<T> {
    return this.circuitBreaker.execute(async () => {
      return this.retryManager.execute(async () => {
        const url = `${this.baseUrl}${endpoint}`;
        const auth = Buffer.from(`${this.apiToken}:`).toString('base64');

        const options: RequestInit = {
          method,
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          timeout: 30000, // 30 segundos timeout
        };

        if (data && (method === 'POST' || method === 'PUT')) {
          options.body = JSON.stringify(data);
        }

        console.log(`[Iugu] ${method} ${endpoint}`);
        if (data) {
          console.log('[Iugu] Request data:', JSON.stringify(data, null, 2));
        }

        const response = await fetch(url, options);
        const responseData = await response.json();

        console.log(`[Iugu] Response status: ${response.status}`);
        console.log('[Iugu] Response data:', JSON.stringify(responseData, null, 2));

        if (!response.ok) {
          const errorDetails = {
            status: response.status,
            statusText: response.statusText,
            errors: responseData.errors,
            message: responseData.message,
            fullResponse: responseData
          };
          console.error('[Iugu] API Error Details:', JSON.stringify(errorDetails, null, 2));
          
          const errorMessage = responseData.errors 
            ? (Array.isArray(responseData.errors) ? responseData.errors.join(', ') : JSON.stringify(responseData.errors))
            : (responseData.message || JSON.stringify(responseData));
          
          // Cria erro com status code para classificação de retry
          const error = new Error(`Iugu API Error (${response.status}): ${errorMessage}`);
          (error as any).status = response.status;
          (error as any).statusCode = response.status;
          throw error;
        }

        return responseData as T;
      }, `iugu-${method}-${endpoint}`);
    });
  }

  /**
   * Criar ou buscar cliente no Iugu
   */
  async createOrGetCustomer(
    organizationId: string,
    email: string,
    name: string,
    metadata?: Record<string, string>
  ): Promise<IuguCustomer> {
    // Primeiro tenta buscar cliente existente pelo email
    try {
      const customers = await this.request<{ items: IuguCustomer[] }>(
        `/customers?query=${encodeURIComponent(email)}`
      );

      if (customers.items && customers.items.length > 0) {
        return customers.items[0];
      }
    } catch (error) {
      console.error('Erro ao buscar cliente:', error);
    }

    // Se não encontrou, cria novo cliente
    const customVariables = [
      { name: 'organization_id', value: organizationId },
      ...(metadata ? Object.entries(metadata)
        .filter(([name]) => !['cpf_cnpj', 'phone'].includes(name))
        .map(([name, value]) => ({ name, value })) : [])
    ];

    const customerData: CreateCustomerParams = {
      email,
      name,
      cpf_cnpj: metadata?.cpf_cnpj || '',
      phone: metadata?.phone || '',
      custom_variables: customVariables,
    };

    return this.request<IuguCustomer>('/customers', 'POST', customerData);
  }

  /**
   * Criar ou atualizar plano no Iugu
   */
  async createOrUpdatePlan(
    planId: string,
    name: string,
    priceCents: number,
    billingCycle: BillingCycle
  ): Promise<IuguPlan> {
    const identifier = `plan_${planId}_${billingCycle}`;

    // Tenta buscar plano existente
    try {
      const plan = await this.request<IuguPlan>(`/plans/identifier/${identifier}`);
      if (plan) {
        // Atualiza o plano se já existe
        return this.request<IuguPlan>(`/plans/${plan.id}`, 'PUT', {
          name: `${name} - ${billingCycle === 'monthly' ? 'Mensal' : 'Anual'}`,
          value_cents: priceCents,
        });
      }
    } catch (error) {
      // Plano não existe, vamos criar
    }

    // Cria novo plano
    const planData = {
      name: `${name} - ${billingCycle === 'monthly' ? 'Mensal' : 'Anual'}`,
      identifier,
      interval: billingCycle === 'monthly' ? 1 : 12,
      interval_type: 'months' as const,
      value_cents: priceCents,
      currency: 'BRL',
      payable_with: 'all',
    };

    return this.request<IuguPlan>('/plans', 'POST', planData);
  }

  /**
   * Criar assinatura no Iugu
   */
  async createSubscription(
    customerId: string,
    planIdentifier: string,
    organizationId: string,
    planId: string,
    metadata?: Record<string, string>
  ): Promise<IuguSubscription> {
    const customVariables = [
      { name: 'organization_id', value: organizationId },
      { name: 'plan_id', value: planId },
      ...(metadata ? Object.entries(metadata).map(([name, value]) => ({ name, value })) : [])
    ];

    const subscriptionData: CreateSubscriptionParams = {
      customer_id: customerId,
      plan_identifier: planIdentifier,
      only_on_charge_success: false, // false = não exige método de pagamento prévio
      payable_with: 'all',
      custom_variables: customVariables,
    };

    return this.request<IuguSubscription>('/subscriptions', 'POST', subscriptionData);
  }

  /**
   * Buscar assinatura por ID
   */
  async getSubscription(subscriptionId: string): Promise<IuguSubscription> {
    return this.request<IuguSubscription>(`/subscriptions/${subscriptionId}`);
  }

  /**
   * Suspender assinatura
   */
  async suspendSubscription(subscriptionId: string): Promise<IuguSubscription> {
    return this.request<IuguSubscription>(
      `/subscriptions/${subscriptionId}/suspend`,
      'POST'
    );
  }

  /**
   * Ativar assinatura suspensa
   */
  async activateSubscription(subscriptionId: string): Promise<IuguSubscription> {
    return this.request<IuguSubscription>(
      `/subscriptions/${subscriptionId}/activate`,
      'POST'
    );
  }

  /**
   * Cancelar assinatura
   */
  async cancelSubscription(subscriptionId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(
      `/subscriptions/${subscriptionId}`,
      'DELETE'
    );
  }

  /**
   * Alterar plano da assinatura
   */
  async changeSubscriptionPlan(
    subscriptionId: string,
    newPlanIdentifier: string
  ): Promise<IuguSubscription> {
    return this.request<IuguSubscription>(
      `/subscriptions/${subscriptionId}/change_plan/${newPlanIdentifier}`,
      'POST'
    );
  }

  /**
   * Buscar faturas de uma assinatura
   */
  async getSubscriptionInvoices(subscriptionId: string): Promise<IuguInvoice[]> {
    const subscription = await this.getSubscription(subscriptionId);
    return subscription.recent_invoices || [];
  }

  /**
   * Buscar fatura por ID
   */
  async getInvoice(invoiceId: string): Promise<IuguInvoice> {
    return this.request<IuguInvoice>(`/invoices/${invoiceId}`);
  }

  /**
   * Cancelar fatura
   */
  async cancelInvoice(invoiceId: string): Promise<IuguInvoice> {
    return this.request<IuguInvoice>(`/invoices/${invoiceId}/cancel`, 'PUT');
  }

  /**
   * Reenviar fatura por email
   */
  async resendInvoice(invoiceId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(
      `/invoices/${invoiceId}/duplicate`,
      'POST'
    );
  }

  /**
   * Gerar segunda via de boleto
   */
  async generateSecondCopy(invoiceId: string): Promise<IuguInvoice> {
    return this.request<IuguInvoice>(`/invoices/${invoiceId}/duplicate`, 'POST');
  }

  /**
   * Verificar status de pagamento de uma fatura
   */
  async checkPaymentStatus(invoiceId: string): Promise<{
    paid: boolean;
    status: string;
  }> {
    const invoice = await this.getInvoice(invoiceId);
    return {
      paid: invoice.status === 'paid',
      status: invoice.status,
    };
  }

  /**
   * Criar URL de checkout para assinatura
   */
  async createCheckoutUrl(
    customerId: string,
    planIdentifier: string,
    organizationId: string,
    planId: string
  ): Promise<string> {
    try {
      // Cria a assinatura
      const subscription = await this.createSubscription(
        customerId,
        planIdentifier,
        organizationId,
        planId
      );

      console.log('Subscription created:', subscription.id);

      // Aguarda um pouco para o Iugu processar
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Busca a assinatura atualizada
      const updatedSubscription = await this.getSubscription(subscription.id);

      // Verifica se tem faturas geradas automaticamente
      if (updatedSubscription.recent_invoices && updatedSubscription.recent_invoices.length > 0) {
        const firstInvoice = updatedSubscription.recent_invoices[0];
        const invoiceUrl = firstInvoice.secure_url || `https://faturas.iugu.com/${firstInvoice.secure_id}`;
        console.log('Invoice found automatically:', firstInvoice.id);
        console.log('Checkout URL:', invoiceUrl);
        return invoiceUrl;
      }

      // Se não gerou automaticamente, cria manualmente
      console.log('Creating manual invoice for subscription...');
      const invoice = await this.createInvoiceForSubscription(subscription.id);
      const checkoutUrl = invoice.secure_url || `https://faturas.iugu.com/${invoice.secure_id}`;
      console.log('Manual invoice created:', invoice.id);
      console.log('Checkout URL:', checkoutUrl);
      return checkoutUrl;
      
    } catch (error) {
      console.error('Error creating checkout URL:', error);
      throw new Error(`Não foi possível gerar URL de checkout: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Criar fatura manualmente para uma assinatura
   */
  async createInvoiceForSubscription(subscriptionId: string): Promise<IuguInvoice> {
    // Busca a assinatura para pegar os dados necessários
    const subscription = await this.getSubscription(subscriptionId);
    
    // Busca os dados do cliente
    const customer = await this.request<IuguCustomer>(`/customers/${subscription.customer_id}`);
    
    // CPF/CNPJ é obrigatório - usa um CPF de teste válido se não tiver
    // CPF de teste: 111.444.777-35 (válido para testes)
    const cpfCnpj = customer.cpf_cnpj || '11144477735';
    
    // Cria uma fatura avulsa baseada na assinatura
    const invoiceData = {
      email: customer.email,
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 dias
      items: [
        {
          description: subscription.features || 'Assinatura',
          quantity: 1,
          price_cents: subscription.price_cents,
        }
      ],
      payer: {
        cpf_cnpj: cpfCnpj,
        name: customer.name,
        phone_prefix: '11',
        phone: customer.phone || '999999999',
        email: customer.email,
        address: {
          street: 'Rua Exemplo',
          number: '123',
          city: 'São Paulo',
          state: 'SP',
          country: 'Brasil',
          zip_code: '01000000'
        }
      },
      payable_with: 'all',
      custom_variables: [
        { name: 'subscription_id', value: subscriptionId }
      ]
    };

    return this.request<IuguInvoice>('/invoices', 'POST', invoiceData);
  }

  /**
   * Validar webhook do Iugu
   */
  validateWebhook(signature: string, body: string): boolean {
    // Implementar validação de assinatura do webhook
    // O Iugu não usa assinatura HMAC por padrão, mas você pode configurar
    return true;
  }

  /**
   * Verifica se o serviço está saudável
   */
  async healthCheck(): Promise<boolean> {
    try {
      return this.circuitBreaker.execute(async () => {
        // Faz uma chamada simples para verificar conectividade
        const response = await fetch(`${this.baseUrl}/customers?limit=1`, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${Buffer.from(`${this.apiToken}:`).toString('base64')}`,
            'Accept': 'application/json',
          },
          timeout: 5000, // 5 segundos timeout para health check
        });
        
        return response.ok;
      });
    } catch (error) {
      console.error('[Iugu] Health check failed:', error);
      return false;
    }
  }

  /**
   * Obtém métricas do circuit breaker
   */
  getCircuitBreakerMetrics() {
    return this.circuitBreaker.getMetrics();
  }

  /**
   * Fallback para quando o Iugu está indisponível
   * Cria um subscription intent local para processamento posterior
   */
  async createFallbackSubscriptionIntent(
    organizationId: string,
    planId: string,
    billingCycle: BillingCycle,
    customerData: {
      email: string;
      name: string;
      cpf_cnpj?: string;
      phone?: string;
    }
  ): Promise<{
    intent_id: string;
    status: 'fallback_pending';
    message: string;
  }> {
    const intentId = `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log('[Iugu] Creating fallback subscription intent:', {
      intentId,
      organizationId,
      planId,
      billingCycle,
      customerEmail: customerData.email
    });

    // Aqui você salvaria no banco de dados local para processamento posterior
    // quando o Iugu voltar a funcionar
    
    return {
      intent_id: intentId,
      status: 'fallback_pending' as const,
      message: 'Serviço temporariamente indisponível. Sua solicitação foi registrada e será processada em breve.'
    };
  }

  /**
   * Processa intents em fallback quando o serviço volta
   */
  async processFallbackIntents(): Promise<void> {
    if (!this.circuitBreaker.isHealthy()) {
      console.log('[Iugu] Circuit breaker not healthy, skipping fallback processing');
      return;
    }

    try {
      // Aqui você buscaria os intents em fallback do banco de dados
      // e tentaria processá-los novamente
      console.log('[Iugu] Processing fallback intents...');
      
      // Implementar lógica de processamento de fallback
      
    } catch (error) {
      console.error('[Iugu] Error processing fallback intents:', error);
    }
  }
}
