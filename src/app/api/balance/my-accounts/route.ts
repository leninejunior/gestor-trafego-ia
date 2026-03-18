/**
 * API para buscar saldo das contas do usuário
 * Disponível para TODOS os usuários
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Buscar saldos diretamente da tabela
    const { data: balances, error: balancesError } = await supabase
      .from('ad_account_balances')
      .select('*')
      .order('status', { ascending: false }) // Críticos primeiro
      .order('balance', { ascending: true })

    if (balancesError) {
      console.error('Error fetching balances:', balancesError)
      return NextResponse.json({ error: 'Error fetching balances' }, { status: 500 })
    }

    // Calcular resumo
    const summary = {
      total_accounts: balances?.length || 0,
      total_balance: balances?.reduce((sum, b) => sum + (Number(b.balance) || 0), 0) || 0,
      critical_accounts: balances?.filter(b => b.status === 'critical').length || 0,
      warning_accounts: balances?.filter(b => b.status === 'warning').length || 0,
      healthy_accounts: balances?.filter(b => b.status === 'healthy').length || 0,
      total_daily_spend: balances?.reduce((sum, b) => sum + (Number(b.daily_spend) || 0), 0) || 0
    }

    return NextResponse.json({
      balances: balances || [],
      summary
    })

  } catch (error) {
    console.error('Error in balance API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
