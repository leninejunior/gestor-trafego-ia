import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PlanLimitsService } from '@/lib/middleware/plan-limits';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verificar autenticação do usuário
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const planService = new PlanLimitsService();
    
    // Buscar limites e uso atual
    const [limits, usage] = await Promise.all([
      planService.getUserPlanLimits(user.id),
      planService.getUserUsage(user.id)
    ]);

    if (!limits || !usage) {
      return NextResponse.json({ error: 'Erro ao buscar informações do plano' }, { status: 500 });
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
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}