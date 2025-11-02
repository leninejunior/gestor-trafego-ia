import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

/**
 * Testes de integração com webhooks do Iugu
 * Testa processamento de eventos em ambiente sandbox
 * Requirements: 2.1, 4.1, 8.1
 */

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
  })),
  auth: {
    admin: {
      createUser: jest.fn(),
      updateUserById: jest.fn()
    }
  }
};

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => mockSupabase
}));

// Mock do serviço Iugu
const mockIuguService = {
  validateWebhookSignature: jest.fn(),
  createCustomer: jest.fn(),
  createSubscription: jest.fn(),
  getSubscription: jest.fn(),
  cancelSubscription: jest.fn()
};

jest.mock('@/lib/iugu/iugu-service', () => ({
  IuguService: jest.fn(() => mockIuguService)
}));

describe('Integração com Webhooks do Iugu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup padrão dos mocks
    mockIuguService.validateWebhookSignature.mockReturnValue(true);
    mockSupabase.from.mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: {
              id: 'test-intent-123',
              status: 'pending',
              user_email: 'test@exemplo.com',
              user_name: 'Test User',
              organization_name: 'Test Org',
              plan_id: 'plan-123'
            },
            error: null
          }))
        }))
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: { id: 'new-record' },
            error: null
          }))
        }))
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({
              data: { id: 'updated-record' },
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

  describe('Webhook de Invoice Status Changed', () => {
    it('deve processar webhook de pagamento confirmado', async () => {
      const webhookPayload = {
        event: 'invoice.status_changed',
        data: {
          id: 'invoice-123',
          status: 'paid',
          subscription_id: 'sub-123',
          customer_id: 'customer-123',
          total_cents: 9990,
          paid_at: '2024-01-15T10:30:00Z',
          items: [{
            description: 'Plano Pro - Mensal',
            quantity: 1,
            price_cents: 9990
          }]
        }
      };

      // Mock da requisição HTTP
      const mockRequest = {
        method: 'POST',
        headers: {
          'x-iugu-signature': 'valid-signature',
          'content-type': 'application/json'
        },
        body: JSON.stringify(webhookPayload)
      };

      // Simular processamento do webhook
      const { POST } = await import('@/app/api/webhooks/iugu/route');
      const response = await POST(mockRequest as any);

      expect(response.status).toBe(200);
      
      // Verificar que o subscription intent foi atualizado
      expect(mockSupabase.from).toHaveBeenCalledWith('subscription_intents');
      
      // Verificar que o log do webhook foi criado
      expect(mockSupabase.from).toHaveBeenCalledWith('webhook_logs');
    });

    it('deve processar webhook de pagamento falhado', async () => {
      const webhookPayload = {
        event: 'invoice.status_changed',
        data: {
          id: 'invoice-456',
          status: 'canceled',
          subscription_id: 'sub-456',
          customer_id: 'customer-456',
          total_cents: 4990,
          canceled_at: '2024-01-15T11:00:00Z',
          cancel_reason: 'payment_failed'
        }
      };

      const mockRequest = {
        method: 'POST',
        headers: {
          'x-iugu-signature': 'valid-signature',
          'content-type': 'application/json'
        },
        body: JSON.stringify(webhookPayload)
      };

      const { POST } = await import('@/app/api/webhooks/iugu/route');
      const response = await POST(mockRequest as any);

      expect(response.status).toBe(200);
      
      // Verificar que o status foi atualizado para failed
      const updateCall = mockSupabase.from().update;
      expect(updateCall).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed'
        })
      );
    });

    it('deve rejeitar webhook com assinatura inválida', async () => {
      mockIuguService.validateWebhookSignature.mockReturnValue(false);

      const webhookPayload = {
        event: 'invoice.status_changed',
        data: { id: 'invoice-789' }
      };

      const mockRequest = {
        method: 'POST',
        headers: {
          'x-iugu-signature': 'invalid-signature',
          'content-type': 'application/json'
        },
        body: JSON.stringify(webhookPayload)
      };

      const { POST } = await import('@/app/api/webhooks/iugu/route');
      const response = await POST(mockRequest as any);

      expect(response.status).toBe(401);
      
      // Verificar que nenhuma atualização foi feita
      expect(mockSupabase.from().update).not.toHaveBeenCalled();
    });
  });

  describe('Webhook de Subscription Activated', () => {
    it('deve criar conta de usuário automaticamente', async () => {
      const webhookPayload = {
        event: 'subscription.activated',
        data: {
          id: 'sub-activated-123',
          customer_id: 'customer-activated-123',
          plan_identifier: 'plan-pro-monthly',
          activated_at: '2024-01-15T12:00:00Z',
          customer: {
            email: 'newuser@exemplo.com',
            name: 'Novo Usuário'
          }
        }
      };

      // Mock para criação de usuário
      mockSupabase.auth.admin.createUser.mockResolvedValue({
        data: {
          user: {
            id: 'new-user-id',
            email: 'newuser@exemplo.com'
          }
        },
        error: null
      });

      const mockRequest = {
        method: 'POST',
        headers: {
          'x-iugu-signature': 'valid-signature',
          'content-type': 'application/json'
        },
        body: JSON.stringify(webhookPayload)
      };

      const { POST } = await import('@/app/api/webhooks/iugu/route');
      const response = await POST(mockRequest as any);

      expect(response.status).toBe(200);
      
      // Verificar criação de usuário
      expect(mockSupabase.auth.admin.createUser).toHaveBeenCalledWith({
        email: 'newuser@exemplo.com',
        password: expect.any(String),
        email_confirm: true,
        user_metadata: {
          name: 'Novo Usuário'
        }
      });
    });

    it('deve criar organização e membership', async () => {
      const webhookPayload = {
        event: 'subscription.activated',
        data: {
          id: 'sub-org-123',
          customer_id: 'customer-org-123',
          plan_identifier: 'plan-basic-annual',
          activated_at: '2024-01-15T13:00:00Z'
        }
      };

      // Mock subscription intent com dados da organização
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: {
          id: 'intent-org-123',
          user_email: 'org@exemplo.com',
          user_name: 'Org User',
          organization_name: 'Nova Organização',
          plan_id: 'plan-basic'
        },
        error: null
      });

      const mockRequest = {
        method: 'POST',
        headers: {
          'x-iugu-signature': 'valid-signature',
          'content-type': 'application/json'
        },
        body: JSON.stringify(webhookPayload)
      };

      const { POST } = await import('@/app/api/webhooks/iugu/route');
      const response = await POST(mockRequest as any);

      expect(response.status).toBe(200);
      
      // Verificar criação de organização
      expect(mockSupabase.from).toHaveBeenCalledWith('organizations');
      
      // Verificar criação de membership
      expect(mockSupabase.from).toHaveBeenCalledWith('organization_memberships');
    });

    it('deve enviar email de boas-vindas', async () => {
      const webhookPayload = {
        event: 'subscription.activated',
        data: {
          id: 'sub-welcome-123',
          customer_id: 'customer-welcome-123',
          plan_identifier: 'plan-pro-monthly',
          activated_at: '2024-01-15T14:00:00Z'
        }
      };

      // Mock do serviço de email
      const mockEmailService = {
        sendWelcomeEmail: jest.fn().mockResolvedValue(true)
      };

      jest.doMock('@/lib/services/email-notification-service', () => ({
        EmailNotificationService: jest.fn(() => mockEmailService)
      }));

      const mockRequest = {
        method: 'POST',
        headers: {
          'x-iugu-signature': 'valid-signature',
          'content-type': 'application/json'
        },
        body: JSON.stringify(webhookPayload)
      };

      const { POST } = await import('@/app/api/webhooks/iugu/route');
      const response = await POST(mockRequest as any);

      expect(response.status).toBe(200);
    });
  });

  describe('Retry Logic e Error Handling', () => {
    it('deve implementar retry para falhas temporárias', async () => {
      let attemptCount = 0;
      
      // Mock que falha nas primeiras tentativas
      mockSupabase.from().update().eq().select().single.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return Promise.reject(new Error('Temporary database error'));
        }
        return Promise.resolve({
          data: { id: 'success-after-retry' },
          error: null
        });
      });

      const webhookPayload = {
        event: 'invoice.status_changed',
        data: {
          id: 'invoice-retry-123',
          status: 'paid',
          subscription_id: 'sub-retry-123'
        }
      };

      const mockRequest = {
        method: 'POST',
        headers: {
          'x-iugu-signature': 'valid-signature',
          'content-type': 'application/json'
        },
        body: JSON.stringify(webhookPayload)
      };

      const { POST } = await import('@/app/api/webhooks/iugu/route');
      const response = await POST(mockRequest as any);

      expect(response.status).toBe(200);
      expect(attemptCount).toBe(3);
    });

    it('deve registrar erro após esgotar tentativas', async () => {
      // Mock que sempre falha
      mockSupabase.from().update().eq().select().single.mockRejectedValue(
        new Error('Persistent database error')
      );

      const webhookPayload = {
        event: 'invoice.status_changed',
        data: {
          id: 'invoice-error-123',
          status: 'paid',
          subscription_id: 'sub-error-123'
        }
      };

      const mockRequest = {
        method: 'POST',
        headers: {
          'x-iugu-signature': 'valid-signature',
          'content-type': 'application/json'
        },
        body: JSON.stringify(webhookPayload)
      };

      const { POST } = await import('@/app/api/webhooks/iugu/route');
      const response = await POST(mockRequest as any);

      expect(response.status).toBe(500);
      
      // Verificar que o erro foi registrado
      expect(mockSupabase.from).toHaveBeenCalledWith('webhook_logs');
    });

    it('deve implementar deduplicação de eventos', async () => {
      // Mock que retorna evento já processado
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: {
          id: 'existing-log',
          event_id: 'duplicate-event-123',
          status: 'processed'
        },
        error: null
      });

      const webhookPayload = {
        event: 'invoice.status_changed',
        data: {
          id: 'invoice-duplicate-123',
          status: 'paid',
          subscription_id: 'sub-duplicate-123'
        }
      };

      const mockRequest = {
        method: 'POST',
        headers: {
          'x-iugu-signature': 'valid-signature',
          'content-type': 'application/json',
          'x-iugu-delivery-id': 'duplicate-event-123'
        },
        body: JSON.stringify(webhookPayload)
      };

      const { POST } = await import('@/app/api/webhooks/iugu/route');
      const response = await POST(mockRequest as any);

      expect(response.status).toBe(200);
      
      // Verificar que não houve processamento duplicado
      expect(mockSupabase.from().update).not.toHaveBeenCalled();
    });
  });

  describe('Circuit Breaker Pattern', () => {
    it('deve abrir circuit breaker após muitas falhas', async () => {
      // Simular muitas falhas consecutivas
      for (let i = 0; i < 5; i++) {
        mockSupabase.from().update().eq().select().single.mockRejectedValueOnce(
          new Error('Database connection failed')
        );

        const webhookPayload = {
          event: 'invoice.status_changed',
          data: {
            id: `invoice-fail-${i}`,
            status: 'paid',
            subscription_id: `sub-fail-${i}`
          }
        };

        const mockRequest = {
          method: 'POST',
          headers: {
            'x-iugu-signature': 'valid-signature',
            'content-type': 'application/json'
          },
          body: JSON.stringify(webhookPayload)
        };

        const { POST } = await import('@/app/api/webhooks/iugu/route');
        await POST(mockRequest as any);
      }

      // Próxima requisição deve ser rejeitada pelo circuit breaker
      const webhookPayload = {
        event: 'invoice.status_changed',
        data: {
          id: 'invoice-circuit-open',
          status: 'paid',
          subscription_id: 'sub-circuit-open'
        }
      };

      const mockRequest = {
        method: 'POST',
        headers: {
          'x-iugu-signature': 'valid-signature',
          'content-type': 'application/json'
        },
        body: JSON.stringify(webhookPayload)
      };

      const { POST } = await import('@/app/api/webhooks/iugu/route');
      const response = await POST(mockRequest as any);

      expect(response.status).toBe(503); // Service Unavailable
    });
  });

  describe('Dead Letter Queue', () => {
    it('deve enviar eventos não processáveis para DLQ', async () => {
      const webhookPayload = {
        event: 'unknown.event.type',
        data: {
          id: 'unknown-event-123',
          some_field: 'some_value'
        }
      };

      const mockRequest = {
        method: 'POST',
        headers: {
          'x-iugu-signature': 'valid-signature',
          'content-type': 'application/json'
        },
        body: JSON.stringify(webhookPayload)
      };

      const { POST } = await import('@/app/api/webhooks/iugu/route');
      const response = await POST(mockRequest as any);

      expect(response.status).toBe(200);
      
      // Verificar que foi enviado para DLQ
      expect(mockSupabase.from).toHaveBeenCalledWith('webhook_dead_letter_queue');
    });

    it('deve processar eventos da DLQ periodicamente', async () => {
      // Mock de eventos na DLQ
      mockSupabase.from().select().eq().mockResolvedValue({
        data: [
          {
            id: 'dlq-1',
            event_type: 'invoice.status_changed',
            payload: {
              event: 'invoice.status_changed',
              data: { id: 'invoice-dlq-1', status: 'paid' }
            },
            retry_count: 2,
            created_at: new Date().toISOString()
          }
        ],
        error: null
      });

      // Simular processamento da DLQ
      const { POST } = await import('@/app/api/cron/webhook-dlq-processor/route');
      const response = await POST({} as any);

      expect(response.status).toBe(200);
      
      // Verificar que eventos foram reprocessados
      expect(mockSupabase.from().update).toHaveBeenCalled();
    });
  });
});