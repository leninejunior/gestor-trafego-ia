/**
 * API para Chat com Agente de IA - Admin
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
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

    const body = await request.json().catch(() => ({}))
    const analysisType = typeof body?.analysis_type === 'string' ? body.analysis_type : 'general'

    return NextResponse.json(
      {
        response: 'Chat de IA indisponível: integração com provedor real não configurada.',
        confidence: 0,
        analysis_type: analysisType,
        timestamp: new Date().toISOString(),
        tokens_used: 0,
        processing_time: 0,
        isRealData: false,
        code: 'FEATURE_UNAVAILABLE'
      },
      { status: 501 }
    )
  } catch (error) {
    console.error('Error in AI chat:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
