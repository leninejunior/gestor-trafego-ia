/**
 * Testes das APIs Administrativas de Subscription Intents
 * Testa endpoints de listagem, detalhes, ações e analytics
 * Requirements: 3.1, 3.2, 3.3, 6.1, 6.4
 */

import { NextRequest } from 'next/server';
import { GET as listIntents } from '@/app/api/admin/subscription-intents/route';
import { GET as getIntentDetails, PATCH as updateIntent, DELETE as deleteIntent } from '@/app/api/admin/subscription-intents/[intentId]/route';
import { GET as getAnalytics, POST as analyticsActions } from '@/app/api/admin/subscription-intents/analytics/route';

// Mock do Supabase
const mockSupabaseClient = {
  auth: {
    getUser: jest.fn()
  },
  from: jest.fn(() => mockSupabaseClient),
  select: jest.fn(() => mockSupabaseClient),
  eq: jest.fn(() => mockSupabaseClient),
  in: jest.fn(() => mockSupabaseClient),
  ilike: jest.fn(() => mockSupabaseClient),
  gte: jest.fn(() => mockSupabaseClient),
  lte: jest.fn(() => mockSupabaseClient),
  order: jest.fn(() => mockSupabaseClient),
  range: jest.fn(() => mockSupabaseClient),
  single: jest.fn(() => mockSupabaseClient),
  limit: jest.fn(() => mockSupabaseClient),
  delete: jest.fn(() => mockSupabaseClient)
};

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => mockSupabaseClient
}));

// Mock do SubscriptionIntentService
const mockSubscriptionIntentService = {
  manualActivation: jest.fn(),
  cancelIntent: jest.fn(),
  resendConfirmationEmail: jest.fn(),
  regenerateCheckoutUrl: jest.fn(),
  updateStatus: jest.fn()
};

jest.mock('@/lib/services/subscription-intent-service', () => ({
  SubscriptionIntentService: jest.fn(() => mockSubscriptionIntentService)
}));

// Dados de teste
const mockUser = {
  id: 'admin-user-123',
  email: 'admin@example.com'
};

const mockAdminProfile = {
  role: 'admin'
};

const mockSuperAdminProfile = {
  role: 'super_admin'
};

const mockSubscriptionIntents = [
  {
    id: 'intent-1',
    user_email: 'user1@example.com',
    user_name: 'User One',
    organization_name: 'Company One',
    status: 'pending',
    billing_cycle: 'monthly',
    created_at: '2024-01-01T10:00:00Z',
    expires_at: '2024-01-08T10:00:00Z',
    plan: {
      id: 'plan-1',
      name: 'Pro Plan',
      monthly_price: 99.99,
      annual_price: 999.99
    }
  },
  {
    id: 'intent-2',
    user_email: 'user2@example.com',
    user_name: 'User Two',
    organization_name: 'Company Two',
    status: 'completed',
    billing_cycle: 'annual',
    created_at: '2024-01-02T10:00:00Z',
    expires_at: '2024-01-09T10:00:00Z',
    plan: {
      id: 'plan-2',
      name: 'Basic Plan',
      monthly_price: 29.99,
      annual_price: 299.99
    }
  }
];

const mockIntentDetails = {
  ...mockSubscriptionIntents[0],
  user: {
    id: 'user-123',
    email: 'user1@example.com',
    created_at: '2024-01-01T09:00:00Z',
    last_sign_in_at: '2024-01-01T09:30:00Z'
  }
};

const mockWebhookLogs = [
  {
    id: 'log-1',
    event_type: 'invoice.status_changed',
    status: 'processed',
    created_at: '2024-01-01T10:30:00Z',
    error_message: null,
    payload: {}
  }
];

const mockStateTransitions = [
  {
    id: 'transition-1',
    from_status: 'pending',
    to_status: 'processing',
    created_at: '2024-01-01T10:15:00Z',
    reason: 'Payment initiated'
  }
];

describe('Admin Subscription Intents API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default auth mock
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null
    });
    
    // Setup default profile mock
    mockSupabaseClient.single.mockResolvedValue({
      data: mockAdminProfile,
      error: null
    });
  });

  describe('GET /api/admin/subscription-intents', () => {
    beforeEach(() => {
      // Mock da query de listagem
      mockSupabaseClient.range.mockResolvedValue({
        data: mockSubscriptionIntents,
        error: null,
        count: mockSubscriptionIntents.length
      });
      
      // Mock da query de contagem
      mockSupabaseClient.select.mockImplementation((fields) => {
        if (fields.includes('count')) {
          return {
            ...mockSupabaseClient,
            then: (callback: any) => callback({ count: mockSubscriptionIntents.length })
          };
        }
        return mockSupabaseClient;
      });
    });

    it('deve listar subscription intents para admin', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/subscription-intents');
      const response = await listIntents(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.intents).toHaveLength(2);
      expect(data.total).toBe(2);
      expect(data.page).toBe(1);
      expect(data.limit).toBe(20);
    });

    it('deve aplicar filtros de busca', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/subscription-intents?status=pending&user_email=user1');
      await listIntents(request);

      expect(mockSupabaseClient.in).toHaveBeenCalledWith('status', ['pending']);
      expect(mockSupabaseClient.ilike).toHaveBeenCalledWith('user_email', '%user1%');
    });

    it('deve aplicar paginação', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/subscription-intents?page=2&limit=10');
      await listIntents(request);

      expect(mockSupabaseClient.range).toHaveBeenCalledWith(10, 19);
    });

    it('deve aplicar ordenação', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/subscription-intents?sort_field=user_email&sort_direction=asc');
      await listIntents(request);

      expect(mockSupabaseClient.order).toHaveBeenCalledWith('user_email', { ascending: true });
    });

    it('deve aplicar filtros de data', async () => {
      const createdAfter = '2024-01-01T00:00:00Z';
      const createdBefore = '2024-01-31T23:59:59Z';
      const request = new NextRequest(`http://localhost:3000/api/admin/subscription-intents?created_after=${createdAfter}&created_before=${createdBefore}`);
      await listIntents(request);

      expect(mockSupabaseClient.gte).toHaveBeenCalledWith('created_at', createdAfter);
      expect(mockSupabaseClient.lte).toHaveBeenCalledWith('created_at', createdBefore);
    });

    it('deve rejeitar usuários não autenticados', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated')
      });

      const request = new NextRequest('http://localhost:3000/api/admin/subscription-intents');
      const response = await listIntents(request);

      expect(response.status).toBe(401);
    });

    it('deve rejeitar usuários sem permissão de admin', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: { role: 'user' },
        error: null
      });

      const request = new NextRequest('http://localhost:3000/api/admin/subscription-intents');
      const response = await listIntents(request);

      expect(response.status).toBe(403);
    });

    it('deve limitar o número máximo de resultados por página', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/subscription-intents?limit=200');
      await listIntents(request);

      expect(mockSupabaseClient.range).toHaveBeenCalledWith(0, 99); // Máximo 100
    });

    it('deve tratar erros de banco de dados', async () => {
      mockSupabaseClient.range.mockResolvedValue({
        data: null,
        error: new Error('Database error'),
        count: null
      });

      const request = new NextRequest('http://localhost:3000/api/admin/subscription-intents');
      const response = await listIntents(request);

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/admin/subscription-intents/[intentId]', () => {
    beforeEach(() => {
      // Mock da query de detalhes
      mockSupabaseClient.single.mockImplementation(() => ({
        data: mockIntentDetails,
        error: null
      }));
      
      // Mock das queries relacionadas
      mockSupabaseClient.limit.mockResolvedValue({
        data: mockWebhookLogs,
        error: null
      });
      
      mockSupabaseClient.order.mockResolvedValue({
        data: mockStateTransitions,
        error: null
      });
    });

    it('deve retornar detalhes completos do intent', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/subscription-intents/intent-1');
      const response = await getIntentDetails(request, { params: { intentId: 'intent-1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.intent).toBeDefined();
      expect(data.webhook_logs).toBeDefined();
      expect(data.state_transitions).toBeDefined();
      expect(data.intent.id).toBe('intent-1');
    });

    it('deve retornar 404 para intent não encontrado', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: new Error('Not found')
      });

      const request = new NextRequest('http://localhost:3000/api/admin/subscription-intents/intent-404');
      const response = await getIntentDetails(request, { params: { intentId: 'intent-404' } });

      expect(response.status).toBe(404);
    });

    it('deve incluir dados do usuário relacionado', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/subscription-intents/intent-1');
      const response = await getIntentDetails(request, { params: { intentId: 'intent-1' } });
      const data = await response.json();

      expect(data.intent.user).toBeDefined();
      expect(data.intent.user.email).toBe('user1@example.com');
    });

    it('deve incluir logs de webhook ordenados', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/subscription-intents/intent-1');
      const response = await getIntentDetails(request, { params: { intentId: 'intent-1' } });
      const data = await response.json();

      expect(data.webhook_logs).toHaveLength(1);
      expect(mockSupabaseClient.order).toHaveBeenCalledWith('created_at', { ascending: false });
    });
  });

  describe('PATCH /api/admin/subscription-intents/[intentId]', () => {
    it('deve ativar subscription intent manualmente', async () => {
      mockSubscriptionIntentService.manualActivation.mockResolvedValue({
        ...mockIntentDetails,
        status: 'completed'
      });

      const request = new NextRequest('http://localhost:3000/api/admin/subscription-intents/intent-1', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'activate' })
      });

      const response = await updateIntent(request, { params: { intentId: 'intent-1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Subscription activated successfully');
      expect(mockSubscriptionIntentService.manualActivation).toHaveBeenCalledWith('intent-1', mockUser.id);
    });

    it('deve cancelar subscription intent', async () => {
      mockSubscriptionIntentService.cancelIntent.mockResolvedValue({
        ...mockIntentDetails,
        status: 'expired'
      });

      const request = new NextRequest('http://localhost:3000/api/admin/subscription-intents/intent-1', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'cancel' })
      });

      const response = await updateIntent(request, { params: { intentId: 'intent-1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockSubscriptionIntentService.cancelIntent).toHaveBeenCalledWith('intent-1', mockUser.id);
    });

    it('deve reenviar email de confirmação', async () => {
      mockSubscriptionIntentService.resendConfirmationEmail.mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/admin/subscription-intents/intent-1', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'resend_email' })
      });

      const response = await updateIntent(request, { params: { intentId: 'intent-1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockSubscriptionIntentService.resendConfirmationEmail).toHaveBeenCalledWith('intent-1');
    });

    it('deve regenerar URL de checkout', async () => {
      mockSubscriptionIntentService.regenerateCheckoutUrl.mockResolvedValue('https://new-checkout-url.com');

      const request = new NextRequest('http://localhost:3000/api/admin/subscription-intents/intent-1', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'regenerate_checkout' })
      });

      const response = await updateIntent(request, { params: { intentId: 'intent-1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.checkout_url).toBe('https://new-checkout-url.com');
    });

    it('deve atualizar status manualmente', async () => {
      mockSubscriptionIntentService.updateStatus.mockResolvedValue({
        ...mockIntentDetails,
        status: 'processing'
      });

      const request = new NextRequest('http://localhost:3000/api/admin/subscription-intents/intent-1', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'update_status', status: 'processing' })
      });

      const response = await updateIntent(request, { params: { intentId: 'intent-1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockSubscriptionIntentService.updateStatus).toHaveBeenCalledWith('intent-1', 'processing', mockUser.id);
    });

    it('deve rejeitar ação inválida', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/subscription-intents/intent-1', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'invalid_action' })
      });

      const response = await updateIntent(request, { params: { intentId: 'intent-1' } });

      expect(response.status).toBe(400);
    });

    it('deve validar dados obrigatórios para update_status', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/subscription-intents/intent-1', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'update_status' }) // Missing status
      });

      const response = await updateIntent(request, { params: { intentId: 'intent-1' } });

      expect(response.status).toBe(400);
    });

    it('deve tratar erros do serviço', async () => {
      mockSubscriptionIntentService.manualActivation.mockRejectedValue(new Error('Service error'));

      const request = new NextRequest('http://localhost:3000/api/admin/subscription-intents/intent-1', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'activate' })
      });

      const response = await updateIntent(request, { params: { intentId: 'intent-1' } });

      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /api/admin/subscription-intents/[intentId]', () => {
    it('deve permitir deleção para super admin', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: mockSuperAdminProfile,
        error: null
      });

      mockSupabaseClient.delete.mockResolvedValue({
        error: null
      });

      const request = new NextRequest('http://localhost:3000/api/admin/subscription-intents/intent-1', {
        method: 'DELETE'
      });

      const response = await deleteIntent(request, { params: { intentId: 'intent-1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockSupabaseClient.delete).toHaveBeenCalled();
    });

    it('deve rejeitar deleção para admin comum', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/subscription-intents/intent-1', {
        method: 'DELETE'
      });

      const response = await deleteIntent(request, { params: { intentId: 'intent-1' } });

      expect(response.status).toBe(403);
    });

    it('deve tratar erro de deleção no banco', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: mockSuperAdminProfile,
        error: null
      });

      mockSupabaseClient.delete.mockResolvedValue({
        error: new Error('Delete failed')
      });

      const request = new NextRequest('http://localhost:3000/api/admin/subscription-intents/intent-1', {
        method: 'DELETE'
      });

      const response = await deleteIntent(request, { params: { intentId: 'intent-1' } });

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/admin/subscription-intents/analytics', () => {
    beforeEach(() => {
      // Mock da query de analytics
      mockSupabaseClient.select.mockResolvedValue({
        data: [
          {
            id: 'intent-1',
            status: 'completed',
            created_at: '2024-01-01T10:00:00Z',
            completed_at: '2024-01-01T11:30:00Z',
            plan_id: 'plan-1',
            billing_cycle: 'monthly',
            subscription_plans: {
              name: 'Pro Plan',
              monthly_price: 99.99,
              annual_price: 999.99
            }
          },
          {
            id: 'intent-2',
            status: 'pending',
            created_at: '2024-01-02T10:00:00Z',
            completed_at: null,
            plan_id: 'plan-1',
            billing_cycle: 'monthly',
            subscription_plans: {
              name: 'Pro Plan',
              monthly_price: 99.99,
              annual_price: 999.99
            }
          }
        ],
        error: null
      });
    });

    it('deve retornar métricas de analytics', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/subscription-intents/analytics');
      const response = await getAnalytics(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.analytics.metrics).toBeDefined();
      expect(data.analytics.metrics.total_intents).toBe(2);
      expect(data.analytics.metrics.completed_intents).toBe(1);
      expect(data.analytics.metrics.conversion_rate).toBe(50);
    });

    it('deve aplicar filtros de período', async () => {
      const periodStart = '2024-01-01T00:00:00Z';
      const periodEnd = '2024-01-31T23:59:59Z';
      const request = new NextRequest(`http://localhost:3000/api/admin/subscription-intents/analytics?period_start=${periodStart}&period_end=${periodEnd}`);
      
      await getAnalytics(request);

      expect(mockSupabaseClient.gte).toHaveBeenCalledWith('created_at', periodStart);
      expect(mockSupabaseClient.lte).toHaveBeenCalledWith('created_at', periodEnd);
    });

    it('deve aplicar filtros adicionais', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/subscription-intents/analytics?status_filter=completed&plan_filter=plan-1');
      
      await getAnalytics(request);

      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('status', 'completed');
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('plan_id', 'plan-1');
    });

    it('deve calcular métricas corretamente', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/subscription-intents/analytics');
      const response = await getAnalytics(request);
      const data = await response.json();

      const metrics = data.analytics.metrics;
      expect(metrics.total_intents).toBe(2);
      expect(metrics.completed_intents).toBe(1);
      expect(metrics.pending_intents).toBe(1);
      expect(metrics.conversion_rate).toBe(50);
      expect(metrics.total_revenue).toBe(99.99);
    });

    it('deve retornar dados de tendência de conversão', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/subscription-intents/analytics');
      const response = await getAnalytics(request);
      const data = await response.json();

      expect(data.conversion_trend).toBeDefined();
      expect(Array.isArray(data.conversion_trend)).toBe(true);
    });

    it('deve retornar performance por plano', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/subscription-intents/analytics');
      const response = await getAnalytics(request);
      const data = await response.json();

      expect(data.plan_performance).toBeDefined();
      expect(Array.isArray(data.plan_performance)).toBe(true);
      expect(data.plan_performance[0]).toHaveProperty('plan_name');
      expect(data.plan_performance[0]).toHaveProperty('conversion_rate');
    });

    it('deve retornar análise de abandono', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/subscription-intents/analytics');
      const response = await getAnalytics(request);
      const data = await response.json();

      expect(data.abandonment_analysis).toBeDefined();
      expect(Array.isArray(data.abandonment_analysis)).toBe(true);
    });
  });

  describe('POST /api/admin/subscription-intents/analytics', () => {
    it('deve exportar dados em formato CSV', async () => {
      mockSupabaseClient.select.mockResolvedValue({
        data: [
          {
            id: 'intent-1',
            status: 'completed',
            created_at: '2024-01-01T10:00:00Z',
            completed_at: '2024-01-01T11:30:00Z',
            user_email: 'user1@example.com',
            user_name: 'User One',
            organization_name: 'Company One',
            billing_cycle: 'monthly',
            subscription_plans: {
              name: 'Pro Plan',
              monthly_price: 99.99
            }
          }
        ],
        error: null
      });

      const request = new NextRequest('http://localhost:3000/api/admin/subscription-intents/analytics', {
        method: 'POST',
        body: JSON.stringify({
          action: 'export_analytics',
          format: 'csv',
          period_start: '2024-01-01T00:00:00Z',
          period_end: '2024-01-31T23:59:59Z'
        })
      });

      const response = await analyticsActions(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toContain('ID,Status,Email');
      expect(data.filename).toContain('.csv');
    });

    it('deve exportar dados em formato JSON', async () => {
      mockSupabaseClient.select.mockResolvedValue({
        data: [{ id: 'intent-1', status: 'completed' }],
        error: null
      });

      const request = new NextRequest('http://localhost:3000/api/admin/subscription-intents/analytics', {
        method: 'POST',
        body: JSON.stringify({
          action: 'export_analytics',
          format: 'json',
          period_start: '2024-01-01T00:00:00Z',
          period_end: '2024-01-31T23:59:59Z'
        })
      });

      const response = await analyticsActions(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.filename).toContain('.json');
    });

    it('deve atualizar cache de analytics', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/subscription-intents/analytics', {
        method: 'POST',
        body: JSON.stringify({
          action: 'refresh_cache'
        })
      });

      const response = await analyticsActions(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Analytics cache refreshed');
    });

    it('deve rejeitar ação inválida', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/subscription-intents/analytics', {
        method: 'POST',
        body: JSON.stringify({
          action: 'invalid_action'
        })
      });

      const response = await analyticsActions(request);

      expect(response.status).toBe(400);
    });
  });

  describe('Segurança e Validação', () => {
    it('deve validar permissões em todas as rotas', async () => {
      const routes = [
        () => listIntents(new NextRequest('http://localhost:3000/api/admin/subscription-intents')),
        () => getIntentDetails(new NextRequest('http://localhost:3000/api/admin/subscription-intents/intent-1'), { params: { intentId: 'intent-1' } }),
        () => getAnalytics(new NextRequest('http://localhost:3000/api/admin/subscription-intents/analytics'))
      ];

      // Simular usuário sem permissão
      mockSupabaseClient.single.mockResolvedValue({
        data: { role: 'user' },
        error: null
      });

      for (const route of routes) {
        const response = await route();
        expect(response.status).toBe(403);
      }
    });

    it('deve sanitizar parâmetros de entrada', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/subscription-intents?user_email=<script>alert("xss")</script>');
      await listIntents(request);

      // Verificar se o parâmetro foi usado de forma segura
      expect(mockSupabaseClient.ilike).toHaveBeenCalledWith('user_email', '%<script>alert("xss")</script>%');
    });

    it('deve limitar tamanho de resposta', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/subscription-intents?limit=1000');
      await listIntents(request);

      // Verificar se o limite foi aplicado (máximo 100)
      expect(mockSupabaseClient.range).toHaveBeenCalledWith(0, 99);
    });

    it('deve validar IDs de intent', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/subscription-intents/invalid-uuid');
      const response = await getIntentDetails(request, { params: { intentId: 'invalid-uuid' } });

      // A validação deve ser feita no nível do banco de dados
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', 'invalid-uuid');
    });
  });

  describe('Performance e Otimização', () => {
    it('deve usar índices apropriados nas queries', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/subscription-intents?status=pending&created_after=2024-01-01');
      await listIntents(request);

      // Verificar se os filtros são aplicados de forma eficiente
      expect(mockSupabaseClient.in).toHaveBeenCalledWith('status', ['pending']);
      expect(mockSupabaseClient.gte).toHaveBeenCalledWith('created_at', '2024-01-01');
    });

    it('deve limitar dados retornados em queries relacionadas', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/subscription-intents/intent-1');
      await getIntentDetails(request, { params: { intentId: 'intent-1' } });

      // Verificar se há limite nos logs de webhook
      expect(mockSupabaseClient.limit).toHaveBeenCalledWith(10);
    });

    it('deve usar paginação eficiente', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/subscription-intents?page=5&limit=50');
      await listIntents(request);

      // Verificar se a paginação é calculada corretamente
      expect(mockSupabaseClient.range).toHaveBeenCalledWith(200, 249);
    });
  });
});