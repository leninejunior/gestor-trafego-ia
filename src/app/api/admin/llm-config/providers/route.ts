/**
 * API para Provedores LLM - Admin
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function ensureSuperAdmin() {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), supabase, user: null }
  }

  const { data: userRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!userRole || userRole.role !== 'super_admin') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), supabase, user: null }
  }

  return { error: null, supabase, user }
}

export async function GET(_request: NextRequest) {
  try {
    const { error } = await ensureSuperAdmin()
    if (error) {
      return error
    }

    return NextResponse.json({
      providers: [],
      summary: {
        total_providers: 0,
        active_providers: 0,
        connected_providers: 0,
        total_usage: 0,
        total_cost: 0
      },
      message: 'Nenhum provedor LLM real configurado'
    })
  } catch (error) {
    console.error('Error fetching LLM providers:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(_request: NextRequest) {
  try {
    const { error } = await ensureSuperAdmin()
    if (error) {
      return error
    }

    return NextResponse.json(
      {
        error: 'Provider management is not available without persistent LLM provider storage',
        code: 'NOT_IMPLEMENTED'
      },
      { status: 501 }
    )
  } catch (error) {
    console.error('Error creating LLM provider:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
