import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

/**
 * Testes de integração para criação de clientes e assinaturas no Iugu
 * Testa fluxo completo de checkout até ativação
 * Requirements: 2.1, 4.1, 8.1
 */

// Mock do serviço Iugu
const mockIuguService = {
  createCustomer: jest.fn(),
  createSubscription: jest.fn(),
  getSubscription: jest.fn(),
  cancelSubscription: jest.fn(),
  createInvoice: jest.fn(),
  getInvoice: jest.fn(),
  validateWebhookSignature: jest.fn()
};

jest.mock('@/lib/iugu/iugu-service', () => ({
  IuguService: jest.fn(() => mockIuguService)
}));

// Mock do Supabase
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn()
      }))
    })),
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn()
      }))
    })),
    update: jest.fn(() => ({
      eq: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn()
        }))
      }))
    }))
  }))
};

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => mockSupabase
}));

describe('Integração Iugu - Clientes e Assinaturas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup padrão dos mocks
    mockSupabase.from.mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: {
              id: 'plan-123',
              name: 'Plano Pro',
              price_monthly: 99.90,
              price_annual: 959.20,
              iugu_plan_id: 'iugu-plan-pro'
            },
            error: null
          }))
        }))
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: { id: 'new-intent-123' },
            error: null
          }))
        }))
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({
              data: { id: 'updated-intent' },
              error: null
            }))
          }))
        }))
      }))
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Criação de Cliente no Iugu', () => {
    it('deve criar cliente com dados válidos', async () => {
      // Mock resposta do Iugu
      mockIuguService.createCustomer.mockResolvedValue({
        id: 'iugu-customer-123',
        email: 'cliente@exemplo.com',
        name: 'Cliente Teste',
        cpf_cnpj: '12345678901'
      });

      const customerData = {
        email: 'cliente@exemplo.com',
        name: 'Cliente Teste',
        cpf_cnpj: '12345678901',
        phone: '11999999999'
      };

      // Simular chamada da API de checkout
      const mockRequest = {
        method: 'POST',
        json: () => Promise.resolve({
          plan_id: 'plan-123',
          billing_cycle: 'monthly',
          user_data: customerData
        })
      };

      const { POST } = await import('@/app/api/subscriptions/checkout-iugu/route');
      const response = await POST(mockRequest as any);

      expect(response.status).toBe(200);
      
      // Verificar criação do cliente no Iugu
      expect(mockIuguService.createCustomer).toHaveBeenCalledWith({
        email: 'cliente@exemplo.com',
        name: 'Cliente Teste',
        cpf_cnpj: '12345678901',
        phone_prefix: '11',
        phone: '999999999'
      });
    });

    it('deve lidar com erro na criação do cliente', async () => {
      // Mock erro do Iugu
      mockIuguService.createCustomer.mockRejectedValue(
        new Error('Email já cadastrado')
      );

      const customerData = {
        email: 'duplicado@exemplo.com',
        name: 'Cliente Duplicado',
        cpf_cnpj: '98765432100'
      };

      const mockRequest = {
        method: 'POST',
        json: () => Promise.resolve({
          plan_id: 'plan-123',
          billing_cycle: 'monthly',
          user_data: customerData
        })
      };

      const { POST } = await import('@/app/api/subscriptions/checkout-iugu/route');
      const response = await POST(mockRequest as any);

      expect(response.status).toBe(400);
      
      const responseData = await response.json();
      expect(responseData.error).toContain('Email já cadastrado');
    });

    it('deve validar dados obrigatórios do cliente', async () => {
      const invalidCustomerData = {
        email: 'email-invalido',
        name: '',
        cpf_cnpj: '123' // CPF inválido
      };

      const mockRequest = {
        method: 'POST',
        json: () => Promise.resolve({
          plan_id: 'plan-123',
          billing_cycle: 'monthly',
          user_data: invalidCustomerData
        })
      };

      const { POST } = await import('@/app/api/subscriptions/checkout-iugu/route');
      const response = await POST(mockRequest as any);

      expect(response.status).toBe(400);
      
      const responseData = await response.json();
      expect(responseData.errors).toContain('Email inválido');
      expect(responseData.errors).toContain('Nome é obrigatório');
      expect(responseData.errors).toContain('CPF/CNPJ inválido');
    });
  });

  describe('Criação de Assinatura no Iugu', () => {
    it('deve criar assinatura mensal com sucesso', async () => {
      // Mock cliente criado
      mockIuguService.createCustomer.mockResolvedValue({
        id: 'iugu-customer-456',
        email: 'mensal@exemplo.com'
      });

      // Mock assinatura criada
      mockIuguService.createSubscription.mockResolvedValue({
        id: 'iugu-subscription-456',
        customer_id: 'iugu-customer-456',
        plan_identifier: 'iugu-plan-pro',
        recent_invoices: [{
          id: 'invoice-456',
          secure_url: 'https://iugu.com/checkout/invoice-456',
          status: 'pending'
        }]
      });

      const customerData = {
        email: 'mensal@exemplo.com',
        name: 'Cliente Mensal',
        cpf_cnpj: '11122233344',
        organization_name: 'Empresa Mensal'
      };

      const mockRequest = {
        method: 'POST',
        json: () => Promise.resolve({
          plan_id: 'plan-123',
          billing_cycle: 'monthly',
          user_data: customerData
        })
      };

      const { POST } = await import('@/app/api/subscriptions/checkout-iugu/route');
      const response = await POST(mockRequest as any);

      expect(response.status).toBe(200);
      
      // Verificar criação da assinatura
      expect(mockIuguService.createSubscription).toHaveBeenCalledWith({
        customer_id: 'iugu-customer-456',
        plan_identifier: 'iugu-plan-pro',
        expires_at: expect.any(String)
      });

      const responseData = await response.json();
      expect(responseData.checkout_url).toBe('https://iugu.com/checkout/invoice-456');
    });

    it('deve criar assinatura anual com desconto', async () => {
      // Mock cliente criado
      mockIuguService.createCustomer.mockResolvedValue({
        id: 'iugu-customer-789',
        email: 'anual@exemplo.com'
      });

      // Mock assinatura anual
      mockIuguService.createSubscription.mockResolvedValue({
        id: 'iugu-subscription-789',
        customer_id: 'iugu-customer-789',
        plan_identifier: 'iugu-plan-pro-annual',
        recent_invoices: [{
          id: 'invoice-789',
          secure_url: 'https://iugu.com/checkout/invoice-789',
          status: 'pending',
          total_cents: 95920 // Preço com desconto
        }]
      });

      const customerData = {
        email: 'anual@exemplo.com',
        name: 'Cliente Anual',
        cpf_cnpj: '55566677788',
        organization_name: 'Empresa Anual'
      };

      const mockRequest = {
        method: 'POST',
        json: () => Promise.resolve({
          plan_id: 'plan-123',
          billing_cycle: 'annual',
          user_data: customerData
        })
      };

      const { POST } = await import('@/app/api/subscriptions/checkout-iugu/route');
      const response = await POST(mockRequest as any);

      expect(response.status).toBe(200);
      
      // Verificar que foi usado o plano anual
      expect(mockIuguService.createSubscription).toHaveBeenCalledWith({
        customer_id: 'iugu-customer-789',
        plan_identifier: 'iugu-plan-pro-annual',
        expires_at: expect.any(String)
      });
    });

    it('deve lidar com erro na criação da assinatura', async () => {
      // Mock cliente criado com sucesso
      mockIuguService.createCustomer.mockResolvedValue({
        id: 'iugu-customer-error',
        email: 'erro@exemplo.com'
      });

      // Mock erro na criação da assinatura
      mockIuguService.createSubscription.mockRejectedValue(
        new Error('Plano não encontrado')
      );

      const customerData = {
        email: 'erro@exemplo.com',
        name: 'Cliente Erro',
        cpf_cnpj: '99988877766'
      };

      const mockRequest = {
        method: 'POST',
        json: () => Promise.resolve({
          plan_id: 'plan-inexistente',
          billing_cycle: 'monthly',
          user_data: customerData
        })
      };

      const { POST } = await import('@/app/api/subscriptions/checkout-iugu/route');
      const response = await POST(mockRequest as any);

      expect(response.status).toBe(400);
      
      const responseData = await response.json();
      expect(responseData.error).toContain('Plano não encontrado');
    });
  });

  describe('Consulta de Status de Assinatura', () => {
    it('deve consultar status de assinatura ativa', async () => {
      // Mock assinatura ativa
      mockIuguService.getSubscription.mockResolvedValue({
        id: 'iugu-subscription-active',
        customer_id: 'iugu-customer-active',
        plan_identifier: 'iugu-plan-pro',
        active: true,
        suspended: false,
        recent_invoices: [{
          id: 'invoice-active',
          status: 'paid',
          paid_at: '2024-01-15T10:00:00Z'
        }]
      });

      // Mock subscription intent
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: {
          id: 'intent-active',
          iugu_subscription_id: 'iugu-subscription-active',
          status: 'completed'
        },
        error: null
      });

      const mockRequest = {
        method: 'GET'
      };

      const { GET } = await import('@/app/api/subscriptions/status/intent-active/route');
      const response = await GET(mockRequest as any, { params: { intentId: 'intent-active' } });

      expect(response.status).toBe(200);
      
      const responseData = await response.json();
      expect(responseData.status).toBe('completed');
      expect(responseData.subscription_active).toBe(true);
    });

    it('deve consultar status de assinatura suspensa', async () => {
      // Mock assinatura suspensa
      mockIuguService.getSubscription.mockResolvedValue({
        id: 'iugu-subscription-suspended',
        customer_id: 'iugu-customer-suspended',
        plan_identifier: 'iugu-plan-basic',
        active: false,
        suspended: true,
        suspend_reason: 'payment_failed',
        recent_invoices: [{
          id: 'invoice-suspended',
          status: 'canceled',
          canceled_at: '2024-01-15T11:00:00Z'
        }]
      });

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: {
          id: 'intent-suspended',
          iugu_subscription_id: 'iugu-subscription-suspended',
          status: 'failed'
        },
        error: null
      });

      const mockRequest = {
        method: 'GET'
      };

      const { GET } = await import('@/app/api/subscriptions/status/intent-suspended/route');
      const response = await GET(mockRequest as any, { params: { intentId: 'intent-suspended' } });

      expect(response.status).toBe(200);
      
      const responseData = await response.json();
      expect(responseData.status).toBe('failed');
      expect(responseData.subscription_active).toBe(false);
      expect(responseData.suspend_reason).toBe('payment_failed');
    });
  });

  describe('Cancelamento de Assinatura', () => {
    it('deve cancelar assinatura com sucesso', async () => {
      // Mock cancelamento no Iugu
      mockIuguService.cancelSubscription.mockResolvedValue({
        id: 'iugu-subscription-canceled',
        active: false,
        suspended: true,
        canceled_at: '2024-01-15T15:00:00Z'
      });

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: {
          id: 'intent-cancel',
          iugu_subscription_id: 'iugu-subscription-canceled',
          status: 'completed'
        },
        error: null
      });

      const mockRequest = {
        method: 'POST',
        json: () => Promise.resolve({
          intent_id: 'intent-cancel',
          reason: 'customer_request'
        })
      };

      const { POST } = await import('@/app/api/subscriptions/recovery/cancel/route');
      const response = await POST(mockRequest as any);

      expect(response.status).toBe(200);
      
      // Verificar cancelamento no Iugu
      expect(mockIuguService.cancelSubscription).toHaveBeenCalledWith(
        'iugu-subscription-canceled'
      );

      const responseData = await response.json();
      expect(responseData.success).toBe(true);
    });

    it('deve lidar com erro no cancelamento', async () => {
      // Mock erro no cancelamento
      mockIuguService.cancelSubscription.mockRejectedValue(
        new Error('Assinatura já cancelada')
      );

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: {
          id: 'intent-error-cancel',
          iugu_subscription_id: 'iugu-subscription-error',
          status: 'completed'
        },
        error: null
      });

      const mockRequest = {
        method: 'POST',
        json: () => Promise.resolve({
          intent_id: 'intent-error-cancel',
          reason: 'customer_request'
        })
      };

      const { POST } = await import('@/app/api/subscriptions/recovery/cancel/route');
      const response = await POST(mockRequest as any);

      expect(response.status).toBe(400);
      
      const responseData = await response.json();
      expect(responseData.error).toContain('Assinatura já cancelada');
    });
  });

  describe('Regeneração de Cobrança', () => {
    it('deve regenerar cobrança para intent expirado', async () => {
      // Mock intent expirado
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: {
          id: 'intent-expired',
          status: 'expired',
          iugu_customer_id: 'iugu-customer-regen',
          plan_id: 'plan-123',
          billing_cycle: 'monthly'
        },
        error: null
      });

      // Mock nova assinatura
      mockIuguService.createSubscription.mockResolvedValue({
        id: 'iugu-subscription-regen',
        customer_id: 'iugu-customer-regen',
        recent_invoices: [{
          id: 'invoice-regen',
          secure_url: 'https://iugu.com/checkout/invoice-regen',
          status: 'pending'
        }]
      });

      const mockRequest = {
        method: 'POST',
        json: () => Promise.resolve({
          intent_id: 'intent-expired'
        })
      };

      const { POST } = await import('@/app/api/subscriptions/recovery/regenerate/route');
      const response = await POST(mockRequest as any);

      expect(response.status).toBe(200);
      
      // Verificar criação de nova assinatura
      expect(mockIuguService.createSubscription).toHaveBeenCalledWith({
        customer_id: 'iugu-customer-regen',
        plan_identifier: 'iugu-plan-pro',
        expires_at: expect.any(String)
      });

      const responseData = await response.json();
      expect(responseData.checkout_url).toBe('https://iugu.com/checkout/invoice-regen');
    });

    it('deve rejeitar regeneração para intent não expirado', async () => {
      // Mock intent ativo
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: {
          id: 'intent-active',
          status: 'pending',
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hora no futuro
        },
        error: null
      });

      const mockRequest = {
        method: 'POST',
        json: () => Promise.resolve({
          intent_id: 'intent-active'
        })
      };

      const { POST } = await import('@/app/api/subscriptions/recovery/regenerate/route');
      const response = await POST(mockRequest as any);

      expect(response.status).toBe(400);
      
      const responseData = await response.json();
      expect(responseData.error).toContain('não está expirado');
    });
  });

  describe('Cenários de Falha e Recovery', () => {
    it('deve implementar retry para falhas de rede', async () => {
      let attemptCount = 0;
      
      // Mock que falha nas primeiras tentativas
      mockIuguService.createCustomer.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Network timeout');
        }
        return Promise.resolve({
          id: 'iugu-customer-retry',
          email: 'retry@exemplo.com'
        });
      });

      const customerData = {
        email: 'retry@exemplo.com',
        name: 'Cliente Retry',
        cpf_cnpj: '12312312312'
      };

      const mockRequest = {
        method: 'POST',
        json: () => Promise.resolve({
          plan_id: 'plan-123',
          billing_cycle: 'monthly',
          user_data: customerData
        })
      };

      const { POST } = await import('@/app/api/subscriptions/checkout-iugu/route');
      const response = await POST(mockRequest as any);

      expect(response.status).toBe(200);
      expect(attemptCount).toBe(3);
    });

    it('deve falhar após esgotar tentativas de retry', async () => {
      // Mock que sempre falha
      mockIuguService.createCustomer.mockRejectedValue(
        new Error('Persistent API error')
      );

      const customerData = {
        email: 'persistent-error@exemplo.com',
        name: 'Cliente Erro Persistente',
        cpf_cnpj: '45645645645'
      };

      const mockRequest = {
        method: 'POST',
        json: () => Promise.resolve({
          plan_id: 'plan-123',
          billing_cycle: 'monthly',
          user_data: customerData
        })
      };

      const { POST } = await import('@/app/api/subscriptions/checkout-iugu/route');
      const response = await POST(mockRequest as any);

      expect(response.status).toBe(500);
      
      const responseData = await response.json();
      expect(responseData.error).toContain('Persistent API error');
    });
  });
});