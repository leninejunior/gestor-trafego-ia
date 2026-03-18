import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getClientAccess,
  getLatestConnectionByClientId,
} from '@/lib/postgres/meta-connections-repository';
import {
  countRecentLeadsByConnectionId,
  listLeadCampaignStatsByConnectionId,
  listLeadStatusesByConnectionId,
} from '@/lib/postgres/meta-leads-repository';

// GET - Estatísticas de leads
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({ error: 'clientId é obrigatório' }, { status: 400 });
    }

    const access = await getClientAccess(clientId, user.id);
    if (!access.clientExists || !access.hasAccess) {
      return NextResponse.json({ error: 'Conexão não encontrada' }, { status: 404 });
    }

    const connection = await getLatestConnectionByClientId(clientId);
    if (!connection) {
      return NextResponse.json({ error: 'Conexão não encontrada' }, { status: 404 });
    }

    // Estatísticas gerais
    const stats = await listLeadStatusesByConnectionId(connection.id);

    // Contar por status
    const statusCounts = {
      new: 0,
      contacted: 0,
      qualified: 0,
      converted: 0,
      lost: 0,
      total: stats.length
    };

    stats.forEach((lead) => {
      const status = typeof lead.status === 'string' ? lead.status : '';
      if (status in statusCounts) {
        statusCounts[status as keyof typeof statusCounts] += 1;
      }
    });

    // Estatísticas por campanha
    const campaignStats = await listLeadCampaignStatsByConnectionId(connection.id);

    // Leads recentes (últimos 7 dias)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentCount = await countRecentLeadsByConnectionId(connection.id, sevenDaysAgo.toISOString());

    return NextResponse.json({
      overview: statusCounts,
      by_campaign: campaignStats,
      recent_leads_7d: recentCount
    });

  } catch (error: unknown) {
    console.error('Erro ao buscar estatísticas:', error);
    return NextResponse.json({
      error: 'Erro ao buscar estatísticas',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
