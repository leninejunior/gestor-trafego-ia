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

    // Obter parâmetros de query
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('client_id') || 'all'
    const days = parseInt(searchParams.get('days') || '30')

    // Por enquanto, retornar dados simulados
    // Na implementação real, buscar dados demográficos do banco
    const mockDemographics = [
      {
        age_range: '18-24',
        gender: 'masculino',
        impressions: 45000,
        clicks: 900,
        spend: 2500,
        conversions: 25
      },
      {
        age_range: '18-24',
        gender: 'feminino',
        impressions: 52000,
        clicks: 1100,
        spend: 2800,
        conversions: 32
      },
      {
        age_range: '25-34',
        gender: 'masculino',
        impressions: 85000,
        clicks: 1800,
        spend: 4200,
        conversions: 68
      },
      {
        age_range: '25-34',
        gender: 'feminino',
        impressions: 95000,
        clicks: 2100,
        spend: 4800,
        conversions: 78
      },
      {
        age_range: '35-44',
        gender: 'masculino',
        impressions: 65000,
        clicks: 1200,
        spend: 3200,
        conversions: 45
      },
      {
        age_range: '35-44',
        gender: 'feminino',
        impressions: 72000,
        clicks: 1400,
        spend: 3600,
        conversions: 52
      },
      {
        age_range: '45-54',
        gender: 'masculino',
        impressions: 35000,
        clicks: 600,
        spend: 1800,
        conversions: 22
      },
      {
        age_range: '45-54',
        gender: 'feminino',
        impressions: 42000,
        clicks: 750,
        spend: 2100,
        conversions: 28
      },
      {
        age_range: '55+',
        gender: 'masculino',
        impressions: 18000,
        clicks: 280,
        spend: 900,
        conversions: 8
      },
      {
        age_range: '55+',
        gender: 'feminino',
        impressions: 22000,
        clicks: 350,
        spend: 1100,
        conversions: 12
      }
    ]

    return NextResponse.json({
      demographics: mockDemographics,
      total: mockDemographics.length,
      filters: { client_id: clientId, days }
    })

  } catch (error) {
    console.error('Error fetching demographics:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}