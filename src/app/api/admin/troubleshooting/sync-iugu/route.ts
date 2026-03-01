/**
 * API para sincronizar dados com o Iugu
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { intent_id } = await request.json()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    if (!intent_id) {
      return NextResponse.json(
        { error: 'Intent ID é obrigatório' },
        { status: 400 }
      )
    }

    const { data: intent, error: fetchError } = await supabase
      .from('subscription_intents')
      .select('id,status,iugu_customer_id,iugu_subscription_id')
      .eq('id', intent_id)
      .single()

    if (fetchError || !intent) {
      return NextResponse.json(
        { error: 'Intent não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        message: 'Sincronização manual com Iugu indisponível: integração real não implementada nesta rota',
        code: 'NOT_IMPLEMENTED',
        intent: {
          id: intent.id,
          status: intent.status,
          iugu_customer_id: intent.iugu_customer_id,
          iugu_subscription_id: intent.iugu_subscription_id
        }
      },
      { status: 501 }
    )
  } catch (error) {
    console.error('Error syncing with Iugu:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
