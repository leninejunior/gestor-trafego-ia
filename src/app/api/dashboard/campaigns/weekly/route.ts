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

    // Gerar dados semanais baseados no período
    const weeklyData = []
    const weeksToShow = Math.min(Math.ceil(days / 7), 8) // Máximo 8 semanas

    for (let i = weeksToShow - 1; i >= 0; i--) {
      const weekStart = new Date()
      weekStart.setDate(weekStart.getDate() - (i * 7))
      
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)

      const weekLabel = `${weekStart.getDate()}/${weekStart.getMonth() + 1} - ${weekEnd.getDate()}/${weekEnd.getMonth() + 1}`

      // Simular dados da semana (na implementação real, buscar do banco)
      const baseSpend = 3000 + (Math.random() * 2000)
      const baseImpressions = 50000 + (Math.random() * 30000)
      const baseClicks = Math.floor(baseImpressions * (0.015 + Math.random() * 0.01))
      const baseConversions = Math.floor(baseClicks * (0.02 + Math.random() * 0.03))
      const roas = baseSpend > 0 ? (baseConversions * 50) / baseSpend : 0

      weeklyData.push({
        week: weekLabel,
        spend: Math.round(baseSpend),
        impressions: Math.round(baseImpressions),
        clicks: baseClicks,
        conversions: baseConversions,
        roas: Math.round(roas * 100) / 100
      })
    }

    return NextResponse.json({
      weekly: weeklyData,
      total: weeklyData.length,
      filters: { client_id: clientId, days }
    })

  } catch (error) {
    console.error('Error fetching weekly data:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}