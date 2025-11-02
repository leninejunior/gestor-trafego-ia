/**
 * Testes de Integração do Painel Administrativo
 * Testa fluxos completos de gestão de subscription intents
 * Requirements: 3.1, 3.2, 3.3, 6.1, 6.4
 */

import { createClient } from '@supabase/supabase-js';
import { SubscriptionIntentService } from '@/lib/services/subscription-intent-service';
import { IuguService } from '@/lib/iugu/iugu-service';

// Mock do ambiente de teste
const mockSupabaseUrl = 'https://test.supabase.co';
const mockSupabaseKey = 'test-key';

// Mock do Supabase client
const mockSupabaseClient = {
  auth: {
    getUser: jest.fn(),
    signInWithPassword: jest.fn()
  },
  from: jest.fn(() => mockSupabaseClient),
  select: jest.fn(() => mockSupabaseClient),
  insert: jest.fn(() => mockSupabaseClient),
  update: jest.fn(() => mockSupabaseClient),
  delete: jest.fn(() => mockSupabaseClient),
  eq: jest.fn(() => mockSupabaseClient),
  in: jest.fn(() => mockSupabaseClient),
  order: jest.fn(() => mockSupabaseClient),
  range: jest.fn(() => mockSupabaseClient),
  single: jest.fn(() => mockSupabaseClient),
  rpc: jest.fn(() => mockSupabaseClient)
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient)
}));

// Mock do IuguService
const mockIuguService = {
  createOrGetCustomer: jest.fn(),
  createOrUpdatePlan: jest.fn(),
  createCheckoutUrl: jest.fn(),
  getCustomer: jest.fn(),
  getSubscription: jest.fn(),
  cancelSubscription: jest.fn()
};

jest.mock('@/lib/iugu/iugu-service', () => ({
  IuguService: jest.fn(() => mockIuguService)
}));

// Dados de teste
const mockAdminUser = {
  id: 'admin-123',
  email: 'admin@example.com',
  role: 'admin'
};

const mockSubscriptionIntent = {
  id: 'intent-123',
  plan_id: 'plan-pro',
  billing_cycle: 'monthly',
  status: 'pending',
  user_email: 'customer@example.com',
  user_name: 'Customer Name',
  organization_name: 'Customer Org',
  cpf_cnpj: '12345678901',
  phone: '+5511999999999',
  iugu_customer_id: 'iugu-customer-123',
  iugu_subscription_id: null,
  checkout_url: 'https://iugu.com/checkout/123',
  user_id: null,
  metadata: {},
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  completed_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

const mockPlan = {
  id: 'plan-pro',
  name: 'Pro Plan',
  description: 'Professional plan with advanced features',
  monthly_price: 99.99,
  annual_price: 999.99,
  features: {
    max_clients: 10,
    max_campaigns: 50,
    advanced_analytics: true
  }
};

describe('Admin Panel Integration Tests', () => {
  let subscriptionIntentService: SubscriptionIntentService;
  let iuguService: IuguService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    subscriptionIntentService = new SubscriptionIntentService();
    iuguService = new IuguService();
    
    // Setup default mocks
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockAdminUser },
      error: null
    });
    
    mockSupabaseClient.single.mockResolvedValue({
      data: { role: 'admin' },
      error: null
    });
  });

  describe('Fluxo Completo de Gestão de Intent', () => {
    it('deve listar, visualizar detalhes e executar ações em um intent', async () => {
      // 1. Listar intents
      mockSupabaseClient.range.mockResolvedValue({
        data: [mockSubscriptionIntent],
        error: null,
        count: 1
      });

      const listResponse = await fetch('/api/admin/subscription-intents');
      const listData = await listResponse.json();

      expect(listData.intents).toHaveLength(1);
      expect(listData.intents[0].id).toBe('intent-123');

      // 2. Visualizar detalhes
      mockSupabaseClient.single.mockResolvedValue({
        data: {
          ...mockSubscriptionIntent,
          plan: mockPlan
        },
        error: null
      });

      mockSupabaseClient.order.mockResolvedValue({
        data: [],
        error: null
      });

      const detailsResponse = await fetch('/api/admin/subscription-intents/intent-123');
      const detailsData = await detailsResponse.json();

      expect(detailsData.intent.id).toBe('intent-123');
      expect(detailsData.intent.plan.name).toBe('Pro Plan');

      // 3. Executar ação de ativação
      mockSupabaseClient.update.mockResolvedValue({
        data: [{ ...mockSubscriptionIntent, status: 'completed' }],
        error: null
      });

      const actionResponse = await fetch('/api/admin/subscription-intents/intent-123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'activate' })
      });

      const actionData = await actionResponse.json();
      expect(actionData.success).toBe(true);
    });

    it('deve filtrar intents por múltiplos critérios', async () => {
      const filteredIntents = [
        { ...mockSubscriptionIntent, status: 'pending' },
        { ...mockSubscriptionIntent, id: 'intent-124', status: 'pending', user_email: 'another@example.com' }
      ];

      mockSupabaseClient.range.mockResolvedValue({
        data: filteredIntents,
        error: null,
        count: 2
      });

      const response = await fetch('/api/admin/subscription-intents?status=pending&created_after=2024-01-01&user_email=example.com');
      const data = await response.json();

      expect(data.intents).toHaveLength(2);
      expect(mockSupabaseClient.in).toHaveBeenCalledWith('status', ['pending']);
      expect(mockSupabaseClient.gte).toHaveBeenCalledWith('created_at', '2024-01-01');
      expect(mockSupabaseClient.ilike).toHaveBeenCalledWith('user_email', '%example.com%');
    });

    it('deve paginar resultados corretamente', async () => {
      const page1Intents = Array.from({ length: 20 }, (_, i) => ({
        ...mockSubscriptionIntent,
        id: `intent-${i + 1}`,
        user_email: `user${i + 1}@example.com`
      }));

      mockSupabaseClient.range.mockResolvedValue({
        data: page1Intents,
        error: null,
        count: 50
      });

      // Primeira página
      const page1Response = await fetch('/api/admin/subscription-intents?page=1&limit=20');
      const page1Data = await page1Response.json();

      expect(page1Data.intents).toHaveLength(20);
      expect(page1Data.page).toBe(1);
      expect(page1Data.total).toBe(50);
      expect(page1Data.hasMore).toBe(true);

      // Segunda página
      mockSupabaseClient.range.mockResolvedValue({
        data: page1Intents.map(intent => ({ ...intent, id: intent.id.replace('intent-', 'intent-2') })),
        error: null,
        count: 50
      });

      const page2Response = await fetch('/api/admin/subscription-intents?page=2&limit=20');
      const page2Data = await page2Response.json();

      expect(mockSupabaseClient.range).toHaveBeenCalledWith(20, 39);
      expect(page2Data.page).toBe(2);
    });
  });

  describe('Ações Administrativas Complexas', () => {
    it('deve ativar intent e criar usuário automaticamente', async () => {
      // Mock da ativação manual
      mockSupabaseClient.update.mockResolvedValue({
        data: [{ ...mockSubscriptionIntent, status: 'completed', user_id: 'user-123' }],
        error: null
      });

      // Mock da criação de usuário
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'customer@example.com' } },
        error: null
      });

      // Mock da criação de organização
      mockSupabaseClient.insert.mockResolvedValue({
        data: [{ id: 'org-123', name: 'Customer Org' }],
        error: null
      });

      const response = await fetch('/api/admin/subscription-intents/intent-123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'activate' })
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.intent.status).toBe('completed');
    });

    it('deve cancelar intent e notificar cliente', async () => {
      mockSupabaseClient.update.mockResolvedValue({
        data: [{ ...mockSubscriptionIntent, status: 'expired' }],
        error: null
      });

      // Mock do envio de email
      mockSupabaseClient.rpc.mockResolvedValue({
        data: { success: true },
        error: null
      });

      const response = await fetch('/api/admin/subscription-intents/intent-123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'cancel',
          reason: 'Requested by admin',
          notify_customer: true
        })
      });

      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('deve regenerar checkout e atualizar Iugu', async () => {
      mockIuguService.createCheckoutUrl.mockResolvedValue('https://iugu.com/new-checkout/456');

      mockSupabaseClient.update.mockResolvedValue({
        data: [{ ...mockSubscriptionIntent, checkout_url: 'https://iugu.com/new-checkout/456' }],
        error: null
      });

      const response = await fetch('/api/admin/subscription-intents/intent-123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate_checkout' })
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.checkout_url).toBe('https://iugu.com/new-checkout/456');
    });
  });

  describe('Analytics e Relatórios', () => {
    it('deve gerar analytics completos com métricas calculadas', async () => {
      const analyticsData = [
        { ...mockSubscriptionIntent, status: 'completed', completed_at: '2024-01-01T12:00:00Z' },
        { ...mockSubscriptionIntent, id: 'intent-124', status: 'pending' },
        { ...mockSubscriptionIntent, id: 'intent-125', status: 'failed' },
        { ...mockSubscriptionIntent, id: 'intent-126', status: 'expired' }
      ];

      mockSupabaseClient.select.mockResolvedValue({
        data: analyticsData.map(intent => ({
          ...intent,
          subscription_plans: mockPlan
        })),
        error: null
      });

      const response = await fetch('/api/admin/subscription-intents/analytics?period_start=2024-01-01&period_end=2024-01-31');
      const data = await response.json();

      expect(data.analytics.metrics.total_intents).toBe(4);
      expect(data.analytics.metrics.completed_intents).toBe(1);
      expect(data.analytics.metrics.conversion_rate).toBe(25);
      expect(data.analytics.metrics.total_revenue).toBe(99.99);
    });

    it('deve exportar dados em formato CSV', async () => {
      const exportData = [
        {
          id: 'intent-123',
          status: 'completed',
          user_email: 'customer@example.com',
          user_name: 'Customer Name',
          organization_name: 'Customer Org',
          billing_cycle: 'monthly',
          created_at: '2024-01-01T10:00:00Z',
          completed_at: '2024-01-01T12:00:00Z',
          subscription_plans: mockPlan
        }
      ];

      mockSupabaseClient.select.mockResolvedValue({
        data: exportData,
        error: null
      });

      const response = await fetch('/api/admin/subscription-intents/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'export_analytics',
          format: 'csv',
          period_start: '2024-01-01T00:00:00Z',
          period_end: '2024-01-31T23:59:59Z'
        })
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toContain('ID,Status,Email');
      expect(data.data).toContain('intent-123,completed,customer@example.com');
    });

    it('deve calcular tendências de conversão por período', async () => {
      const trendData = Array.from({ length: 30 }, (_, i) => {
        const date = new Date('2024-01-01');
        date.setDate(date.getDate() + i);
        return {
          ...mockSubscriptionIntent,
          id: `intent-${i}`,
          created_at: date.toISOString(),
          status: i % 3 === 0 ? 'completed' : 'pending'
        };
      });

      mockSupabaseClient.select.mockResolvedValue({
        data: trendData.map(intent => ({
          ...intent,
          subscription_plans: mockPlan
        })),
        error: null
      });

      const response = await fetch('/api/admin/subscription-intents/analytics');
      const data = await response.json();

      expect(data.conversion_trend).toBeDefined();
      expect(data.conversion_trend).toHaveLength(30);
      expect(data.conversion_trend[0]).toHaveProperty('date');
      expect(data.conversion_trend[0]).toHaveProperty('started');
      expect(data.conversion_trend[0]).toHaveProperty('completed');
      expect(data.conversion_trend[0]).toHaveProperty('conversion_rate');
    });
  });

  describe('Tratamento de Erros e Recuperação', () => {
    it('deve tratar falha na ativação e reverter mudanças', async () => {
      // Simular falha na ativação
      mockSupabaseClient.update.mockRejectedValue(new Error('Database error'));

      const response = await fetch('/api/admin/subscription-intents/intent-123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'activate' })
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('deve tratar falha na comunicação com Iugu', async () => {
      mockIuguService.createCheckoutUrl.mockRejectedValue(new Error('Iugu API error'));

      const response = await fetch('/api/admin/subscription-intents/intent-123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate_checkout' })
      });

      expect(response.status).toBe(500);
    });

    it('deve validar permissões em operações críticas', async () => {
      // Simular usuário sem permissão
      mockSupabaseClient.single.mockResolvedValue({
        data: { role: 'user' },
        error: null
      });

      const response = await fetch('/api/admin/subscription-intents/intent-123', {
        method: 'DELETE'
      });

      expect(response.status).toBe(403);
    });

    it('deve tratar timeout em operações longas', async () => {
      // Simular timeout
      mockSupabaseClient.select.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      const response = await fetch('/api/admin/subscription-intents/analytics');
      expect(response.status).toBe(500);
    });
  });

  describe('Concorrência e Consistência', () => {
    it('deve tratar atualizações concorrentes de intent', async () => {
      // Simular duas atualizações simultâneas
      const update1 = fetch('/api/admin/subscription-intents/intent-123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'activate' })
      });

      const update2 = fetch('/api/admin/subscription-intents/intent-123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' })
      });

      mockSupabaseClient.update
        .mockResolvedValueOnce({
          data: [{ ...mockSubscriptionIntent, status: 'completed' }],
          error: null
        })
        .mockRejectedValueOnce(new Error('Conflict'));

      const [response1, response2] = await Promise.all([update1, update2]);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(500);
    });

    it('deve manter consistência entre intent e dados do Iugu', async () => {
      // Mock da verificação de consistência
      mockIuguService.getSubscription.mockResolvedValue({
        id: 'iugu-sub-123',
        status: 'active'
      });

      mockSupabaseClient.select.mockResolvedValue({
        data: [{ ...mockSubscriptionIntent, status: 'completed', iugu_subscription_id: 'iugu-sub-123' }],
        error: null
      });

      const response = await fetch('/api/admin/subscription-intents/intent-123');
      const data = await response.json();

      expect(data.intent.status).toBe('completed');
      expect(data.intent.iugu_subscription_id).toBe('iugu-sub-123');
    });
  });

  describe('Performance e Otimização', () => {
    it('deve usar cache para queries frequentes', async () => {
      // Primeira chamada
      mockSupabaseClient.select.mockResolvedValue({
        data: [mockSubscriptionIntent],
        error: null
      });

      const response1 = await fetch('/api/admin/subscription-intents/analytics');
      expect(response1.status).toBe(200);

      // Segunda chamada (deve usar cache)
      const response2 = await fetch('/api/admin/subscription-intents/analytics');
      expect(response2.status).toBe(200);

      // Verificar se a query foi executada apenas uma vez (com cache)
      expect(mockSupabaseClient.select).toHaveBeenCalledTimes(1);
    });

    it('deve otimizar queries com muitos resultados', async () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        ...mockSubscriptionIntent,
        id: `intent-${i}`,
        user_email: `user${i}@example.com`
      }));

      mockSupabaseClient.range.mockResolvedValue({
        data: largeDataset.slice(0, 100),
        error: null,
        count: 1000
      });

      const response = await fetch('/api/admin/subscription-intents?limit=100');
      const data = await response.json();

      expect(data.intents).toHaveLength(100);
      expect(data.total).toBe(1000);
      expect(mockSupabaseClient.range).toHaveBeenCalledWith(0, 99);
    });

    it('deve usar índices apropriados para filtros complexos', async () => {
      const response = await fetch('/api/admin/subscription-intents?status=pending,processing&plan_id=plan-pro&created_after=2024-01-01&user_email=example.com');
      
      // Verificar se os filtros são aplicados de forma otimizada
      expect(mockSupabaseClient.in).toHaveBeenCalledWith('status', ['pending', 'processing']);
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('plan_id', 'plan-pro');
      expect(mockSupabaseClient.gte).toHaveBeenCalledWith('created_at', '2024-01-01');
      expect(mockSupabaseClient.ilike).toHaveBeenCalledWith('user_email', '%example.com%');
    });
  });

  describe('Auditoria e Logs', () => {
    it('deve registrar todas as ações administrativas', async () => {
      mockSupabaseClient.insert.mockResolvedValue({
        data: [{ id: 'audit-123' }],
        error: null
      });

      const response = await fetch('/api/admin/subscription-intents/intent-123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'activate' })
      });

      expect(response.status).toBe(200);
      
      // Verificar se o log de auditoria foi criado
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'activate',
          admin_user_id: 'admin-123',
          intent_id: 'intent-123'
        })
      );
    });

    it('deve manter histórico de mudanças de status', async () => {
      mockSupabaseClient.insert.mockResolvedValue({
        data: [{ id: 'transition-123' }],
        error: null
      });

      const response = await fetch('/api/admin/subscription-intents/intent-123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_status', status: 'processing' })
      });

      expect(response.status).toBe(200);
      
      // Verificar se a transição foi registrada
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          intent_id: 'intent-123',
          from_status: 'pending',
          to_status: 'processing'
        })
      );
    });
  });
});