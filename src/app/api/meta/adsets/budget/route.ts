import { NextRequest, NextResponse } from 'next/server';
import { META_CONFIG } from '@/lib/meta/config';

export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adsetId = searchParams.get('adsetId');
    const clientId = searchParams.get('clientId');
    const adAccountId = searchParams.get('adAccountId');
    
    const { daily_budget, lifetime_budget } = await request.json();

    console.log('📝 [ADSET BUDGET] Parâmetros:', { adsetId, clientId, adAccountId, daily_budget, lifetime_budget });

    if (!adsetId) {
      return NextResponse.json({
        error: 'adsetId é obrigatório'
      }, { status: 400 });
    }

    if (!clientId || !adAccountId) {
      return NextResponse.json({
        error: 'clientId e adAccountId são obrigatórios'
      }, { status: 400 });
    }

    if (!daily_budget && !lifetime_budget) {
      return NextResponse.json({
        error: 'É necessário fornecer daily_budget ou lifetime_budget'
      }, { status: 400 });
    }

    // Buscar o token de acesso
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    
    const { data: connection, error: connectionError } = await supabase
      .from('client_meta_connections')
      .select('access_token, is_active')
      .eq('client_id', clientId)
      .eq('ad_account_id', adAccountId)
      .eq('is_active', true)
      .single();

    if (connectionError || !connection) {
      console.error('❌ [ADSET BUDGET] Conexão não encontrada:', connectionError);
      return NextResponse.json({
        error: 'Conexão Meta Ads não encontrada'
      }, { status: 404 });
    }

    if (!connection.is_active) {
      return NextResponse.json({
        error: 'Conexão Meta Ads não está ativa'
      }, { status: 400 });
    }

    // Preparar dados para atualização
    const updateData: any = {
      access_token: connection.access_token
    };

    if (daily_budget) {
      // Meta API espera valores em centavos
      updateData.daily_budget = Math.round(parseFloat(daily_budget) * 100);
    }

    if (lifetime_budget) {
      updateData.lifetime_budget = Math.round(parseFloat(lifetime_budget) * 100);
    }

    // Chamar a Meta API
    const metaApiUrl = `${META_CONFIG.BASE_URL}/${META_CONFIG.API_VERSION}/${adsetId}`;
    
    console.log('🔄 [ADSET BUDGET] Atualizando na Meta API:', { metaApiUrl, updateData: { ...updateData, access_token: '***' } });
    
    const response = await fetch(metaApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData)
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      console.error('❌ [ADSET BUDGET] Erro da Meta API:', data.error);
      return NextResponse.json({
        error: data.error?.message || 'Erro ao atualizar orçamento na Meta API',
        details: data.error
      }, { status: 400 });
    }

    console.log('✅ [ADSET BUDGET] Orçamento atualizado com sucesso');

    return NextResponse.json({
      success: true,
      adsetId,
      daily_budget: daily_budget ? updateData.daily_budget : null,
      lifetime_budget: lifetime_budget ? updateData.lifetime_budget : null,
      message: 'Orçamento do conjunto de anúncios atualizado com sucesso!'
    });

  } catch (error) {
    console.error('💥 [ADSET BUDGET] Erro geral:', error);
    return NextResponse.json({
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
