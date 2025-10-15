/**
 * API para Dados Semanais de Campanhas - Admin
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verificar se é super admin
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!userRole || userRole.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = request.nextUrl
    const days = parseInt(searchParams.get('days') || '30')

    // Gerar dados semanais baseados no período
    const weeks = Math.ceil(days / 7)
    const weeklyData = []

    for (let i = weeks - 1; i >= 0; i--) {
      const weekStart = new Date()
      weekStart.setDate(weekStart.getDate() - (i * 7 + 6))
      
      const weekEnd = new Date()
      weekEnd.setDate(weekEnd.getDate() - (i * 7))

      // Simular dados semanais (em produção, agregaria dados reais)
      const baseSpend = 2000 + Math.random() * 1000
      const baseImpressions = 50000 + Math.random() * 20000
      const baseClicks = baseImpressions * (0.015 + Math.random() * 0.01)
      const baseConversions = baseClicks * (0.02 + Math.random() * 0.03)
      const roas = baseSpend > 0 ? (baseConversions * 50 / baseSpend) : 0

      weeklyData.push({
        week: `${weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} - ${weekEnd.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`,
        spend: Math.round(baseSpend * 100) / 100,
        impressions: Math.round(baseImpressions),
        clicks: Math.round(baseClicks),
        conversions: Math.round(baseConversions),
        roas: Math.round(roas * 100) / 100
      })
    }

    return NextResponse.json({
      weekly: weeklyData,
      period: {
        days,
        weeks: weeklyData.length
      }
    })

  } catch (error) {
    console.error('Error fetching weekly data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}