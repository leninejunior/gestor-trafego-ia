/**
 * API para Insights do Agente de IA - Admin
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!userRole || userRole.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({
      insights: [],
      summary: {
        total_insights: 0,
        by_type: {
          optimization: 0,
          warning: 0,
          opportunity: 0,
          prediction: 0
        },
        by_impact: {
          high: 0,
          medium: 0,
          low: 0
        },
        avg_confidence: 0
      },
      message: 'Nenhum insight real disponível: integração de IA não configurada'
    })
  } catch (error) {
    console.error('Error fetching AI insights:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
