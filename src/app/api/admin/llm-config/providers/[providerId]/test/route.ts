/**
 * API para Testar Provedor LLM - Admin
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ providerId: string }> }
) {
  try {
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userRole } = await supabase
      .from('memberships')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!userRole || !userRole.role?.includes('super_admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { providerId } = await params

    return NextResponse.json(
      {
        success: false,
        message: `Connection test for provider '${providerId}' is unavailable without real provider integration`,
        code: 'NOT_IMPLEMENTED'
      },
      { status: 501 }
    )
  } catch (error) {
    console.error('Error testing LLM provider:', error)
    return NextResponse.json({
      success: false,
      message: 'Test failed due to internal error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
