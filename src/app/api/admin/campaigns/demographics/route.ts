/**
 * API para Dados Demográficos de Campanhas - Admin
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

    // Data de início
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Simular dados demográficos (em produção, viria da Meta API)
    const demographics = [
      // Por faixa etária
      { age_range: '18-24', gender: 'all', impressions: 125000, clicks: 3200, spend: 2800, conversions: 85 },
      { age_range: '25-34', gender: 'all', impressions: 180000, clicks: 4500, spend: 3900, conversions: 120 },
      { age_range: '35-44', gender: 'all', impressions: 95000, clicks: 2100, spend: 1850, conversions: 65 },
      { age_range: '45-54', gender: 'all', impressions: 65000, clicks: 1300, spend: 1200, conversions: 40 },
      { age_range: '55+', gender: 'all', impressions: 35000, clicks: 650, spend: 580, conversions: 18 },
      
      // Por gênero
      { age_range: 'all', gender: 'male', impressions: 280000, clicks: 6200, spend: 5400, conversions: 180 },
      { age_range: 'all', gender: 'female', impressions: 200000, clicks: 5300, spend: 4600, conversions: 140 },
      { age_range: 'all', gender: 'unknown', impressions: 20000, clicks: 250, spend: 330, conversions: 8 }
    ]

    return NextResponse.json({
      demographics,
      period: {
        days,
        start_date: startDate.toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0]
      }
    })

  } catch (error) {
    console.error('Error fetching demographics:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}