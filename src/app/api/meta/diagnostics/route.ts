import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Endpoint de diagnóstico para verificar métricas da hierarquia Meta Ads
 * 
 * Testa diretamente a API Meta para identificar onde as métricas estão zeradas
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams
    const clientId = searchParams.get('clientId')
    const campaignId = searchParams.get('campaignId')
    
    if (!clientId) {
      return NextResponse.json({ error: 'clientId é obrigatório' }, { status: 400 })
    }
    
    // Buscar conexão ativa
    const { data: connection, error: connError } = await supabase
      .from('client_meta_connections')
      .select('*')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .single()
    
    if (connError || !connection) {
      return NextResponse.json({ 
        error: 'Conexão Meta não encontrada',
        details: connError 
      }, { status: 404 })
    }
    
    const accessToken = connection.access_token
    const adAccountId = connection.ad_account_id
    
    // Período padrão: últimos 30 dias
    const until = new Date().toISOString().split('T')[0]
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    const diagnostics: any = {
      clientId,
      adAccountId,
      period: { since, until },
      timestamp: new Date().toISOString(),
      results: {}
    }
    
    // 1. Testar insights da conta
    try {
      const accountUrl = `https://graph.facebook.com/v18.0/act_${adAccountId}/insights`
      const accountParams = new URLSearchParams({
        access_token: accessToken,
        fields: 'impressions,clicks,spend,reach',
        time_range: JSON.stringify({ since, until })
      })
      
      const accountRes = await fetch(`${accountUrl}?${accountParams}`)
      const accountData = await accountRes.json()
      
      diagnostics.results.account = {
        success: accountRes.ok,
        status: accountRes.status,
        hasData: !!accountData.data?.[0],
        data: accountData.data?.[0] || null,
        error: accountData.error || null
      }
    } catch (error: any) {
      diagnostics.results.account = {
        success: false,
        error: error.message
      }
    }
    
    // 2. Testar campanhas
    try {
      const campaignsUrl = `https://graph.facebook.com/v18.0/act_${adAccountId}/campaigns`
      const campaignsParams = new URLSearchParams({
        access_token: accessToken,
        fields: 'id,name,status',
        limit: '5'
      })
      
      const campaignsRes = await fetch(`${campaignsUrl}?${campaignsParams}`)
      const campaignsData = await campaignsRes.json()
      
      diagnostics.results.campaigns = {
        success: campaignsRes.ok,
        status: campaignsRes.status,
        count: campaignsData.data?.length || 0,
        campaigns: campaignsData.data?.map((c: any) => ({
          id: c.id,
          name: c.name,
          status: c.status
        })) || [],
        error: campaignsData.error || null
      }
      
      // 3. Se temos campanhas, testar insights da primeira
      if (campaignsData.data && campaignsData.data.length > 0) {
        const testCampaignId = campaignId || campaignsData.data[0].id
        const testCampaignName = campaignsData.data.find((c: any) => c.id === testCampaignId)?.name || 'N/A'
        
        // Insights da campanha
        const campaignInsightsUrl = `https://graph.facebook.com/v18.0/${testCampaignId}/insights`
        const campaignInsightsParams = new URLSearchParams({
          access_token: accessToken,
          fields: 'impressions,clicks,spend,reach,ctr,cpc',
          time_range: JSON.stringify({ since, until })
        })
        
        const campaignInsightsRes = await fetch(`${campaignInsightsUrl}?${campaignInsightsParams}`)
        const campaignInsightsData = await campaignInsightsRes.json()
        
        diagnostics.results.campaignInsights = {
          campaignId: testCampaignId,
          campaignName: testCampaignName,
          success: campaignInsightsRes.ok,
          status: campaignInsightsRes.status,
          hasData: !!campaignInsightsData.data?.[0],
          data: campaignInsightsData.data?.[0] || null,
          error: campaignInsightsData.error || null
        }
      }
    } catch (error: any) {
      diagnostics.results.campaigns = {
        success: false,
        error: error.message
      }
    }
    
    // Análise e recomendações
    const analysis: any = {
      hasAccount: !!diagnostics.results.account?.hasData,
      hasCampaigns: (diagnostics.results.campaigns?.count || 0) > 0,
      recommendations: []
    }
    
    if (!analysis.hasAccount) {
      analysis.recommendations.push('A conta não tem dados de insights no período selecionado')
    }
    
    if (!analysis.hasCampaigns) {
      analysis.recommendations.push('Nenhuma campanha encontrada na conta')
    }
    
    if (diagnostics.results.campaignInsights && !diagnostics.results.campaignInsights.hasData) {
      analysis.recommendations.push('Campanha não tem insights no período - pode estar pausada ou sem gastos')
    }
    
    diagnostics.analysis = analysis
    
    return NextResponse.json(diagnostics)
    
  } catch (error: any) {
    console.error('Erro no diagnóstico:', error)
    return NextResponse.json({
      error: 'Erro ao executar diagnóstico',
      details: error.message
    }, { status: 500 })
  }
}