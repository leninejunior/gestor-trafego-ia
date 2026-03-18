import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { MetaAdsClient } from '@/lib/meta/client';
import { UserAccessControlService } from '@/lib/services/user-access-control';
import {
  getClientAccess,
  getSingleActiveConnectionByClientId,
} from '@/lib/postgres/meta-connections-repository';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');
  const campaignId = searchParams.get('campaignId');
  const since = searchParams.get('since');
  const until = searchParams.get('until');
  
  if (!clientId || !campaignId) {
    return NextResponse.json({ error: 'Client ID e Campaign ID são obrigatórios' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    
    // Verificar autenticação do usuário
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Regra principal: mesmo controle de acesso usado no restante das APIs.
    // Fallback legado: schemas antigos baseados em memberships/organization_memberships.
    const accessControl = new UserAccessControlService();
    const hasScopedAccess = await accessControl.hasClientAccess(user.id, clientId);

    if (!hasScopedAccess) {
      const legacyAccess = await getClientAccess(clientId, user.id);

      if (!legacyAccess.clientExists) {
        return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
      }

      if (!legacyAccess.hasAccess) {
        return NextResponse.json({ error: 'Acesso negado ao cliente' }, { status: 403 });
      }
    }

    // Buscar conexão do Meta para este cliente
    const connection = await getSingleActiveConnectionByClientId(clientId);
    const accessToken = typeof connection?.access_token === 'string' ? connection.access_token : null;
    if (!accessToken) {
      return NextResponse.json({ error: 'Conexão com Meta não encontrada' }, { status: 404 });
    }

    // Buscar insights usando o Meta Ads Client
    const metaClient = new MetaAdsClient(accessToken);
    
    const dateRange = since && until ? { since, until } : undefined;
    const insights = await metaClient.getCampaignInsights(campaignId, dateRange);

    return NextResponse.json({ insights });
  } catch (error) {
    console.error('Erro ao buscar insights:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
