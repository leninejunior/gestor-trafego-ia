import { createServiceClient } from '@/lib/supabase/server';
import { PaymentProvider, PaymentTransaction, CreatePaymentRequest } from '@/lib/types/payments';

export class PaymentService {
  private supabase = createServiceClient();

  // Buscar provedor ativo com failover
  async getActiveProvider(orgId: string, preferredProvider?: string): Promise<PaymentProvider | null> {
    let query = this.supabase
      .from('payment_providers')
      .select('*')
      .eq('org_id', orgId)
      .eq('is_active', true);

    if (preferredProvider) {
      query = query.eq('name', preferredProvider);
    }

    query = query.order('priority', { ascending: true });

    const { data: providers, error } = await query;

    if (error || !providers || providers.length === 0) {
      return null;
    }

    // Retornar o primeiro provedor ativo (maior prioridade)
    return providers[0];
  }

  // Criar pagamento com provedor específico
  async createPayment(
    orgId: string, 
    userId: string, 
    request: CreatePaymentRequest
  ): Promise<{ transaction: PaymentTransaction; payment_url?: string }> {
    
    // Buscar provedor
    const provider = await this.getActiveProvider(orgId, request.provider_name);
    if (!provider) {
      throw new Error('Nenhum provedor de pagamento ativo encontrado');
    }

    // Gerar referência única
    const reference_id = `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Criar transação no banco
    const { data: transaction, error } = await this.supabase
      .from('payment_transactions')
      .insert({
        org_id: orgId,
        client_id: request.client_id,
        provider_id: provider.id,
        reference_id,
        amount: request.amount,
        currency: request.currency || 'BRL',
        description: request.description,
        status: 'pending',
        customer_data: request.customer_data,
        metadata: {
          ...request.metadata,
          created_by: userId
        }
      })
      .select(`
        *,
        provider:payment_providers(id, name, display_name, config),
        client:clients(id, name)
      `)
      .single();

    if (error) {
      throw new Error(`Erro ao criar transação: ${error.message}`);
    }

    // Processar pagamento com o provedor
    const paymentResult = await this.processPaymentWithProvider(provider, transaction, request);

    // Atualizar transação com dados do provedor
    if (paymentResult.external_id) {
      await this.supabase
        .from('payment_transactions')
        .update({
          external_id: paymentResult.external_id,
          status: paymentResult.status || 'processing'
        })
        .eq('id', transaction.id);
    }

    return {
      transaction: { ...transaction, ...paymentResult },
      payment_url: paymentResult.payment_url
    };
  }

  // Processar pagamento com provedor específico
  private async processPaymentWithProvider(
    provider: PaymentProvider, 
    transaction: PaymentTransaction,
    request: CreatePaymentRequest
  ): Promise<Partial<PaymentTransaction> & { payment_url?: string }> {
    
    switch (provider.name) {
      case 'stripe':
        return this.processStripePayment(provider, transaction, request);
      
      case 'iugu':
        return this.processIuguPayment(provider, transaction, request);
      
      case 'pagseguro':
        return this.processPagSeguroPayment(provider, transaction, request);
      
      case 'mercadopago':
        return this.processMercadoPagoPayment(provider, transaction, request);
      
      default:
        throw new Error(`Provedor ${provider.name} não implementado`);
    }
  }

  // Implementações específicas dos provedores
  private async processStripePayment(
    provider: PaymentProvider,
    transaction: PaymentTransaction,
    request: CreatePaymentRequest
  ): Promise<Partial<PaymentTransaction> & { payment_url?: string }> {
    
    // TODO: Integrar com Stripe SDK
    // const stripe = new Stripe(provider.config.api_key);
    // const paymentIntent = await stripe.paymentIntents.create({...});
    
    // Por enquanto, simular resposta
    return {
      external_id: `pi_${Math.random().toString(36).substr(2, 24)}`,
      status: 'processing',
      payment_url: `https://checkout.stripe.com/pay/${transaction.reference_id}`
    };
  }

  private async processIuguPayment(
    provider: PaymentProvider,
    transaction: PaymentTransaction,
    request: CreatePaymentRequest
  ): Promise<Partial<PaymentTransaction> & { payment_url?: string }> {
    
    // TODO: Integrar com Iugu API
    return {
      external_id: `iugu_${Math.random().toString(36).substr(2, 20)}`,
      status: 'processing',
      payment_url: `https://faturas.iugu.com/${transaction.reference_id}`
    };
  }

  private async processPagSeguroPayment(
    provider: PaymentProvider,
    transaction: PaymentTransaction,
    request: CreatePaymentRequest
  ): Promise<Partial<PaymentTransaction> & { payment_url?: string }> {
    
    // TODO: Integrar com PagSeguro API
    return {
      external_id: `ps_${Math.random().toString(36).substr(2, 20)}`,
      status: 'processing',
      payment_url: `https://pagseguro.uol.com.br/checkout/${transaction.reference_id}`
    };
  }

  private async processMercadoPagoPayment(
    provider: PaymentProvider,
    transaction: PaymentTransaction,
    request: CreatePaymentRequest
  ): Promise<Partial<PaymentTransaction> & { payment_url?: string }> {
    
    // TODO: Integrar com Mercado Pago SDK
    return {
      external_id: `mp_${Math.random().toString(36).substr(2, 20)}`,
      status: 'processing',
      payment_url: `https://www.mercadopago.com.br/checkout/${transaction.reference_id}`
    };
  }

  // Atualizar status da transação (chamado pelos webhooks)
  async updateTransactionStatus(
    transactionId: string,
    status: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (status === 'succeeded' || status === 'failed') {
      updateData.processed_at = new Date().toISOString();
    }

    if (metadata) {
      updateData.metadata = metadata;
    }

    const { error } = await this.supabase
      .from('payment_transactions')
      .update(updateData)
      .eq('id', transactionId);

    if (error) {
      throw new Error(`Erro ao atualizar transação: ${error.message}`);
    }
  }

  // Buscar transação por ID externo (usado pelos webhooks)
  async findTransactionByExternalId(externalId: string): Promise<PaymentTransaction | null> {
    const { data: transaction, error } = await this.supabase
      .from('payment_transactions')
      .select(`
        *,
        provider:payment_providers(id, name, display_name),
        client:clients(id, name)
      `)
      .eq('external_id', externalId)
      .single();

    if (error) {
      return null;
    }

    return transaction;
  }

  // Estatísticas de pagamentos
  async getPaymentStats(orgId: string, period?: { start: string; end: string }) {
    let query = this.supabase
      .from('payment_transactions')
      .select('amount, status, created_at, provider:payment_providers(name)')
      .eq('org_id', orgId);

    if (period) {
      query = query
        .gte('created_at', period.start)
        .lte('created_at', period.end);
    }

    const { data: transactions, error } = await query;

    if (error) {
      throw new Error(`Erro ao buscar estatísticas: ${error.message}`);
    }

    // Calcular estatísticas
    const total_transactions = transactions.length;
    const total_amount = transactions.reduce((sum, t) => sum + t.amount, 0);
    const succeeded_transactions = transactions.filter(t => t.status === 'succeeded').length;
    const success_rate = total_transactions > 0 ? (succeeded_transactions / total_transactions) * 100 : 0;

    const transactions_by_status = transactions.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const transactions_by_provider = transactions.reduce((acc, t) => {
      const provider = t.provider?.name || 'unknown';
      acc[provider] = (acc[provider] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total_transactions,
      total_amount,
      success_rate,
      avg_processing_time: 0, // TODO: calcular baseado em processed_at - created_at
      transactions_by_status,
      transactions_by_provider
    };
  }
}