import { createClient } from '@/lib/supabase/server';
import {
  PlanLimits,
  CreatePlanLimits,
  UpdatePlanLimits,
  ValidationResult,
  PlanLimitsSchema,
  CreatePlanLimitsSchema,
  UpdatePlanLimitsSchema,
  DEFAULT_PLAN_LIMITS,
} from '@/lib/types/plan-limits';
import { ZodError } from 'zod';

/**
 * Serviço de configuração de limites de planos
 * Implementa requisitos 1.1, 1.2, 1.3, 1.4, 1.5
 */
export class PlanConfigurationService {
  /**
   * Obtém os limites de um plano específico
   * Requisito 1.1: Administrador pode visualizar limites de plano
   */
  async getPlanLimits(planId: string): Promise<PlanLimits | null> {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('plan_limits')
      .select('*')
      .eq('plan_id', planId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Nenhum registro encontrado - retornar null
        return null;
      }
      throw new Error(`Erro ao buscar limites do plano: ${error.message}`);
    }

    return data as PlanLimits;
  }

  /**
   * Cria limites para um plano
   * Se não existir, cria com valores padrão
   * Requisito 1.5: Valores padrão quando não definidos
   */
  async createPlanLimits(planId: string, limits?: Partial<CreatePlanLimits>): Promise<PlanLimits> {
    const supabase = await createClient();

    // Mesclar com valores padrão
    const limitsData: CreatePlanLimits = {
      plan_id: planId,
      ...DEFAULT_PLAN_LIMITS,
      ...limits,
    };

    // Validar dados
    const validation = await this.validateLimits(limitsData);
    if (!validation.valid) {
      throw new Error(`Validação falhou: ${validation.errors?.join(', ')}`);
    }

    const { data, error } = await supabase
      .from('plan_limits')
      .insert(limitsData)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar limites do plano: ${error.message}`);
    }

    return data as PlanLimits;
  }

  /**
   * Atualiza os limites de um plano
   * Requisito 1.2: Administrador pode editar limites de plano
   * Requisito 1.3: Alterações aplicadas apenas para novos dados
   */
  async updatePlanLimits(planId: string, limits: UpdatePlanLimits): Promise<PlanLimits> {
    const supabase = await createClient();

    // Validar dados de atualização
    const validation = await this.validateLimits(limits);
    if (!validation.valid) {
      throw new Error(`Validação falhou: ${validation.errors?.join(', ')}`);
    }

    // Verificar se já existe
    const existing = await this.getPlanLimits(planId);
    
    if (!existing) {
      // Se não existe, criar com os limites fornecidos
      return this.createPlanLimits(planId, limits);
    }

    // Atualizar registro existente
    const { data, error } = await supabase
      .from('plan_limits')
      .update({
        ...limits,
        updated_at: new Date().toISOString(),
      })
      .eq('plan_id', planId)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar limites do plano: ${error.message}`);
    }

    return data as PlanLimits;
  }

  /**
   * Valida limites de plano
   * Requisito 1.4: Validação de campos antes de aplicar
   */
  async validateLimits(limits: Partial<CreatePlanLimits> | UpdatePlanLimits): Promise<ValidationResult> {
    try {
      // Determinar qual schema usar baseado nos campos presentes
      if ('plan_id' in limits) {
        CreatePlanLimitsSchema.parse(limits);
      } else {
        UpdatePlanLimitsSchema.parse(limits);
      }

      return { valid: true };
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
        return {
          valid: false,
          errors,
        };
      }

      return {
        valid: false,
        errors: ['Erro desconhecido na validação'],
      };
    }
  }

  /**
   * Obtém os limites do plano ativo de uma organização
   * Requisito 2.1: Sistema consulta limite de retenção do plano ativo
   */
  async getOrganizationPlanLimits(organizationId: string): Promise<PlanLimits | null> {
    const supabase = await createClient();

    // Buscar assinatura ativa da organização
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('plan_id')
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .single();

    if (subError || !subscription) {
      // Organização sem assinatura ativa
      return null;
    }

    // Buscar limites do plano
    return this.getPlanLimits(subscription.plan_id);
  }

  /**
   * Obtém os limites do plano ativo de um usuário (via organização)
   * Requisito 2.1: Sistema consulta limite de retenção do plano ativo
   */
  async getUserPlanLimits(userId: string): Promise<PlanLimits | null> {
    const supabase = await createClient();

    // Buscar organização do usuário via memberships
    const { data: membership, error: memberError } = await supabase
      .from('memberships')
      .select('organization_id')
      .eq('user_id', userId)
      .single();

    if (memberError || !membership) {
      // Usuário sem organização
      return null;
    }

    // Buscar limites da organização
    return this.getOrganizationPlanLimits(membership.organization_id);
  }

  /**
   * Obtém ou cria limites para um plano
   * Garante que sempre exista um registro de limites
   */
  async getOrCreatePlanLimits(planId: string): Promise<PlanLimits> {
    let limits = await this.getPlanLimits(planId);
    
    if (!limits) {
      limits = await this.createPlanLimits(planId);
    }

    return limits;
  }

  /**
   * Verifica se um usuário pode adicionar mais clientes
   * Baseado no limite do plano da organização
   */
  async canAddClient(userId: string): Promise<{ allowed: boolean; current: number; limit: number }> {
    const supabase = await createClient();

    // Buscar organização do usuário
    const { data: membership, error: memberError } = await supabase
      .from('memberships')
      .select('organization_id')
      .eq('user_id', userId)
      .single();

    if (memberError || !membership) {
      return { allowed: false, current: 0, limit: 0 };
    }

    // Buscar assinatura ativa da organização
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('plan_id')
      .eq('organization_id', membership.organization_id)
      .eq('status', 'active')
      .single();

    if (subError || !subscription) {
      // Sem assinatura ativa - usar limites padrão restritivos
      return { allowed: false, current: 0, limit: 1 };
    }

    // Buscar limites do plano
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('max_clients')
      .eq('id', subscription.plan_id)
      .single();

    if (planError || !plan) {
      return { allowed: false, current: 0, limit: 0 };
    }

    // Se ilimitado, sempre permitir
    if (plan.max_clients === -1) {
      return { allowed: true, current: 0, limit: -1 };
    }

    // Contar clientes atuais da organização
    const { count, error } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', membership.organization_id);

    if (error) {
      console.error('Erro ao contar clientes:', error);
      // Em caso de erro, permitir para não bloquear o usuário
      return { allowed: true, current: 0, limit: plan.max_clients };
    }

    const currentCount = count || 0;
    const allowed = currentCount < plan.max_clients;

    return {
      allowed,
      current: currentCount,
      limit: plan.max_clients,
    };
  }

  /**
   * Verifica se um cliente pode adicionar mais campanhas
   * Baseado no limite do plano da organização
   */
  async canAddCampaign(clientId: string): Promise<{ allowed: boolean; current: number; limit: number }> {
    const supabase = await createClient();

    // Buscar a organização do cliente
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('org_id')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return { allowed: false, current: 0, limit: 0 };
    }

    // Buscar assinatura ativa da organização
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('plan_id')
      .eq('organization_id', client.org_id)
      .eq('status', 'active')
      .single();

    if (subError || !subscription) {
      // Sem assinatura ativa - usar limites padrão restritivos
      return { allowed: false, current: 0, limit: 1 };
    }

    // Buscar limites do plano
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('max_campaigns')
      .eq('id', subscription.plan_id)
      .single();

    if (planError || !plan) {
      return { allowed: false, current: 0, limit: 0 };
    }

    // Se ilimitado, sempre permitir
    if (plan.max_campaigns === -1) {
      return { allowed: true, current: 0, limit: -1 };
    }

    // Contar campanhas atuais do cliente
    const { count, error } = await supabase
      .from('meta_campaigns')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', clientId);

    if (error) {
      console.error('Erro ao contar campanhas:', error);
      // Em caso de erro, permitir para não bloquear o usuário
      return { allowed: true, current: 0, limit: plan.max_campaigns };
    }

    const currentCount = count || 0;
    const allowed = currentCount < plan.max_campaigns;

    return {
      allowed,
      current: currentCount,
      limit: plan.max_campaigns,
    };
  }

  /**
   * Verifica se um usuário pode acessar dados em um período específico
   * Baseado no limite de retenção do plano
   */
  async canAccessDataRange(userId: string, requestedDays: number): Promise<boolean> {
    const limits = await this.getUserPlanLimits(userId);

    if (!limits) {
      return false;
    }

    return requestedDays <= limits.data_retention_days;
  }

  /**
   * Verifica se um usuário pode exportar dados em um formato específico
   */
  async canExport(userId: string, format: 'csv' | 'json'): Promise<boolean> {
    const limits = await this.getUserPlanLimits(userId);

    if (!limits) {
      return false;
    }

    return format === 'csv' ? limits.allow_csv_export : limits.allow_json_export;
  }
}

// Exportar instância singleton
export const planConfigurationService = new PlanConfigurationService();
