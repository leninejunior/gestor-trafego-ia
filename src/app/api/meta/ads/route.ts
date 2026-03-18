import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasOrganizationAccess } from '@/lib/postgres/meta-connections-repository';
import {
  getAdsetContextByIdentifier,
  listAdInsightsByAdId,
  listAdsByAdsetId,
} from '@/lib/postgres/meta-hierarchy-repository';

type InsightRow = Record<string, unknown>;
type AdRow = Record<string, unknown>;

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
    const adsetId = searchParams.get('adsetId');
    const clientId = searchParams.get('clientId');
    const adAccountId = searchParams.get('adAccountId');
    const since = searchParams.get('since');
    const until = searchParams.get('until');

    console.log('🔍 [API ADS] Parâmetros recebidos:', {
      adsetId,
      clientId,
      adAccountId,
      since,
      until
    });

    if (!adsetId) {
      return NextResponse.json(
        { error: 'adsetId é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('❌ [API ADS] Erro de autenticação:', authError);
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    console.log('✅ [API ADS] Usuário autenticado:', user.id);

    const adset = await getAdsetContextByIdentifier(adsetId);
    if (!adset) {
      console.error('❌ [API ADS] Adset não encontrado:', adsetId);
      return NextResponse.json(
        { error: 'Conjunto de anúncios não encontrado ou sem permissão' },
        { status: 404 }
      );
    }

    const hasAccess = await hasOrganizationAccess(user.id, adset.org_id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Conjunto de anúncios não encontrado ou sem permissão' },
        { status: 404 }
      );
    }

    if (clientId && adset.client_id !== clientId) {
      return NextResponse.json(
        { error: 'Conjunto de anúncios não encontrado ou sem permissão' },
        { status: 404 }
      );
    }

    if (adAccountId && adset.ad_account_id && adset.ad_account_id !== adAccountId) {
      return NextResponse.json(
        { error: 'Conjunto de anúncios não encontrado ou sem permissão' },
        { status: 404 }
      );
    }

    console.log('✅ [API ADS] Adset encontrado:', adset.id);

    // Buscar ads do adset - usar adset.id (UUID interno)
    const ads = await listAdsByAdsetId(adset.id);
    console.log(`✅ [API ADS] ${ads?.length || 0} ads encontrados`);

    // Se não houver ads no banco, retornar array vazio
    if (!ads || ads.length === 0) {
      console.log('⚠️ [API ADS] Nenhum ad encontrado no banco');
      return NextResponse.json({ ads: [] });
    }

    // Buscar insights para cada ad
    const adsWithInsights = await Promise.all(
      ads.map(async (ad: AdRow) => {
        const adId = String(ad.id || '');
        const insights = await listAdInsightsByAdId(adId, since, until);

        if (insights && insights.length > 0) {
          return {
            ...ad,
            insights: aggregateInsights(insights)
          };
        }

        return {
          ...ad,
          insights: null
        };
      })
    );

    console.log('✅ [API ADS] Ads com insights processados:', adsWithInsights.length);
    return NextResponse.json({ ads: adsWithInsights });

  } catch (error) {
    console.error('💥 [API ADS] Erro inesperado:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
