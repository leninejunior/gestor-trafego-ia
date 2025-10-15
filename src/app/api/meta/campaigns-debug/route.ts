import { NextRequest, NextResponse } from 'next/server'

// Dados de teste para campanhas
const testCampaigns = [
  {
    id: 'debug_campaign_1',
    name: 'Campanha Debug - Vendas Q4',
    status: 'ACTIVE',
    objective: 'CONVERSIONS',
    spend: '1250.50',
    impressions: '45000',
    clicks: '890',
    ctr: '1.98',
    cpc: '1.40',
    daily_budget: '50.00',
    created_time: '2024-01-15T10:00:00Z'
  },
  {
    id: 'debug_campaign_2',
    name: 'Campanha Debug - Brand Awareness',
    status: 'ACTIVE',
    objective: 'BRAND_AWARENESS',
    spend: '850.75',
    impressions: '32000',
    clicks: '640',
    ctr: '2.00',
    cpc: '1.33',
    daily_budget: '30.00',
    created_time: '2024-01-10T14:30:00Z'
  },
  {
    id: 'debug_campaign_3',
    name: 'Campanha Debug - Lead Generation',
    status: 'PAUSED',
    objective: 'LEAD_GENERATION',
    spend: '2100.25',
    impressions: '78000',
    clicks: '1560',
    ctr: '2.00',
    cpc: '1.35',
    daily_budget: '75.00',
    created_time: '2024-01-05T09:15:00Z'
  }
]

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')
  const adAccountId = searchParams.get('adAccountId')
  
  console.log('🔍 [CAMPAIGNS DEBUG] Parâmetros:', { clientId, adAccountId })
  
  // Simular um pequeno delay para parecer real
  await new Promise(resolve => setTimeout(resolve, 500))
  
  return NextResponse.json({ 
    campaigns: testCampaigns,
    isTestData: true,
    message: 'API de debug - dados de teste sempre disponíveis',
    clientId,
    adAccountId
  })
}