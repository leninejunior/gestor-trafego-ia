import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PlanLimitsService } from '@/lib/middleware/plan-limits';

// Default free plan limits
const DEFAULT_LIMITS = {
  max_clients: 1,
  max_campaigns: 3,
  max_users: 1,
  features: {
    advancedAnalytics: false,
    customReports: false,
    apiAccess: false,
    whiteLabel: false,
    prioritySupport: false
  }
};

const DEFAULT_USAGE = {
  clients: 0,
  campaigns: 0,
  users: 0
};

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verificar autenticação do usuário
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const planService = new PlanLimitsService();
    
    // Buscar limites e uso atual com fallback para valores padrão
    let limits = await planService.getUserPlanLimits(user.id);
    let usage = await planService.getUserUsage(user.id);

    // Se não conseguir buscar, usar valores padrão
    if (!limits) {
      console.warn('Could not fetch plan limits, using defaults');
      limits = DEFAULT_LIMITS;
    }

    if (!usage) {
      console.warn('Could not fetch usage stats, using defaults');
      usage = DEFAULT_USAGE;
    }

    // Calcular percentuais de uso
    const clientsUsage = limits.max_clients === -1 ? 0 : (usage.clients / limits.max_clients) * 100;
    const campaignsUsage = limits.max_campaigns === -1 ? 0 : (usage.campaigns / limits.max_campaigns) * 100;
    const usersUsage = limits.max_users === -1 ? 0 : (usage.users / limits.max_users) * 100;

    // Verificar se está próximo dos limites
    const warnings = [];
    if (clientsUsage > 80) warnings.push('clients');
    if (campaignsUsage > 80) warnings.push('campaigns');
    if (usersUsage > 80) warnings.push('users');

    return NextResponse.json({
      success: true,
      limits,
      usage,
      percentages: {
        clients: Math.round(clientsUsage),
        campaigns: Math.round(campaignsUsage),
        users: Math.round(usersUsage)
      },
      warnings,
      canAddClients: limits.max_clients === -1 || usage.clients < limits.max_clients,
      canAddCampaigns: limits.max_campaigns === -1 || usage.campaigns < limits.max_campaigns,
      canAddUsers: limits.max_users === -1 || usage.users < limits.max_users
    });
  } catch (error) {
    console.error('Erro ao buscar limites do plano:', error);
    
    // Return default limits on error instead of failing
    return NextResponse.json({
      success: true,
      limits: DEFAULT_LIMITS,
      usage: DEFAULT_USAGE,
      percentages: {
        clients: 0,
        campaigns: 0,
        users: 0
      },
      warnings: [],
      canAddClients: true,
      canAddCampaigns: true,
      canAddUsers: true,
      message: 'Using default plan limits due to error'
    });
  }
}