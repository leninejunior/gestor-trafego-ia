import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasOrganizationAccess } from '@/lib/postgres/meta-connections-repository';
import {
  getCampaignContextByIdentifier,
  listAdsetInsightsByAdsetId,
  listAdsetsByCampaignId,
} from '@/lib/postgres/meta-hierarchy-repository';

type InsightRow = Record<string, unknown>;
type AdsetRow = Record<string, unknown>;

function aggregateInsights(insights: InsightRow[]): Record<string, string> {
  const totals = insights.reduce(
    (acc, insight) => {
      const impressions = Number(insight.impressions ?? 0);
      const clicks = Number(insight.clicks ?? 0);
      const spend = Number(insight.spend ?? 0);
      const reach = Number(insight.reach ?? 0);
      const frequency = Number(insight.frequency ?? 0);

      return {
        impressions: acc.impressions + impressions,
        clicks: acc.clicks + clicks,
        spend: acc.spend + spend,
        reach: acc.reach + reach,
        frequencySum: acc.frequencySum + frequency,
      };
    },
    {
      impressions: 0,
      clicks: 0,
      spend: 0,
      reach: 0,
      frequencySum: 0,
    }
  );

  const frequencyAvg = insights.length > 0 ? totals.frequencySum / insights.length : 0;
  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const cpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0;
  const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;

  return {
    impressions: String(totals.impressions),
    clicks: String(totals.clicks),
    spend: String(totals.spend),
    reach: String(totals.reach),
    frequency: String(frequencyAvg.toFixed(2)),
    ctr: String(ctr.toFixed(2)),
    cpc: String(cpc.toFixed(2)),
    cpm: String(cpm.toFixed(2)),
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const campaignId = searchParams.get('campaignId');
    const clientId = searchParams.get('clientId');
    const adAccountId = searchParams.get('adAccountId');
    const since = searchParams.get('since');
    const until = searchParams.get('until');

    console.log('🔍 [API ADSETS] Parâmetros recebidos:', {
      campaignId,
      clientId,
      adAccountId,
      since,
      until
    });

    if (!campaignId) {
      return NextResponse.json(
        { error: 'campaignId é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('❌ [API ADSETS] Erro de autenticação:', authError);
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    console.log('✅ [API ADSETS] Usuário autenticado:', user.id);

    const campaign = await getCampaignContextByIdentifier(campaignId);
    if (!campaign) {
      console.error('❌ [API ADSETS] Campanha não encontrada:', campaignId);
      return NextResponse.json(
        { error: 'Campanha não encontrada ou sem permissão' },
        { status: 404 }
      );
    }

    const hasAccess = await hasOrganizationAccess(user.id, campaign.org_id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Campanha não encontrada ou sem permissão' },
        { status: 404 }
      );
    }

    if (clientId && campaign.client_id !== clientId) {
      return NextResponse.json(
        { error: 'Campanha não encontrada ou sem permissão' },
        { status: 404 }
      );
    }

    if (adAccountId && campaign.ad_account_id && campaign.ad_account_id !== adAccountId) {
      return NextResponse.json(
        { error: 'Campanha não encontrada ou sem permissão' },
        { status: 404 }
      );
    }

    console.log('✅ [API ADSETS] Campanha encontrada:', campaign.id);

    // Buscar adsets da campanha - usar campaign.id (UUID interno)
    const adsets = await listAdsetsByCampaignId(campaign.id);
    console.log(`✅ [API ADSETS] ${adsets?.length || 0} adsets encontrados`);

    // Se não houver adsets no banco, retornar array vazio
    if (!adsets || adsets.length === 0) {
      console.log('⚠️ [API ADSETS] Nenhum adset encontrado no banco');
      return NextResponse.json({ adsets: [] });
    }

    // Buscar insights para cada adset
    const adsetsWithInsights = await Promise.all(
      adsets.map(async (adset: AdsetRow) => {
        const adsetId = String(adset.id || '');
        const insights = await listAdsetInsightsByAdsetId(adsetId, since, until);

        if (insights && insights.length > 0) {
          return {
            ...adset,
            insights: aggregateInsights(insights),
          };
        }

        return {
          ...adset,
          insights: null
        };
      })
    );

    console.log('✅ [API ADSETS] Adsets com insights processados:', adsetsWithInsights.length);

    return NextResponse.json({ adsets: adsetsWithInsights });

  } catch (error) {
    console.error('💥 [API ADSETS] Erro inesperado:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
