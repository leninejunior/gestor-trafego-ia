import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Obter parâmetros
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('client_id') || 'all'

    console.log('=== TEMP CAMPAIGNS API ===')
    console.log('Client ID:', clientId)

    // Se não selecionou cliente, retornar vazio
    if (clientId === 'all') {
      return NextResponse.json({
        campaigns: [],
        total: 0,
        message: 'Selecione um cliente para visualizar as campanhas'
      })
    }

    // Retornar campanhas de teste para o cliente selecionado
    const testCampaigns = [
      {
        id: 'camp_001',
        name: 'Campanha de Conversão - Black Friday',
        status: 'ACTIVE',
        spend: 1250.50,
        impressions: 45000,
        clicks: 890,
        conversions: 23,
        ctr: 1.98,
        cpc: 1.40,
        roas: 4.2,
        reach: 38000,
        frequency: 1.18,
        account_name: 'Conta Meta Ads',
        objective: 'CONVERSIONS',
        created_time: '2024-11-01',
        client_name: 'Coan Consultoria'
      },
      {
        id: 'camp_002',
        name: 'Campanha de Tráfego - Produtos',
        status: 'ACTIVE',
        spend: 890.30,
        impressions: 32000,
        clicks: 650,
        conversions: 18,
        ctr: 2.03,
        cpc: 1.37,
        roas: 3.8,
        reach: 28000,
        frequency: 1.14,
        account_name: 'Conta Meta Ads',
        objective: 'TRAFFIC',
        created_time: '2024-10-28',
        client_name: 'Coan Consultoria'
      },
      {
        id: 'camp_003',
        name: 'Campanha de Alcance - Brand',
        status: 'PAUSED',
        spend: 450.00,
        impressions: 25000,
        clicks: 320,
        conversions: 8,
        ctr: 1.28,
        cpc: 1.41,
        roas: 2.1,
        reach: 22000,
        frequency: 1.14,
        account_name: 'Conta Meta Ads',
        objective: 'REACH',
        created_time: '2024-10-25',
        client_name: 'Coan Consultoria'
      }
    ]

    return NextResponse.json({
      campaigns: testCampaigns,
      total: testCampaigns.length,
      clientName: 'Coan Consultoria',
      accountName: 'Conta Meta Ads',
      message: 'Dados de teste - funcionando!'
    })

  } catch (error) {
    console.error('Error in temp campaigns API:', error)
    return NextResponse.json({
      campaigns: [],
      total: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}