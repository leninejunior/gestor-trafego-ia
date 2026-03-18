/**
 * API para Buscar Saldo das Contas (Admin)
 * Busca da tabela ad_account_balances (atualizada a cada 5min)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Cliente sem RLS para admin
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    // Buscar todos os saldos da tabela
    const { data: balances, error } = await supabaseAdmin
      .from('ad_account_balances')
      .select(`
        *,
        clients (
          name
        )
      `)
      .order('status', { ascending: false }) // Críticos primeiro
      .order('balance', { ascending: true })

    if (error) {
      console.error('Erro ao buscar saldos:', error)
      return NextResponse.json({ error: 'Erro ao buscar saldos' }, { status: 500 })
    }

    // Buscar alertas configurados
    const { data: alerts } = await supabaseAdmin
      .from('balance_alerts')
      .select('ad_account_id')
      .eq('is_active', true)

    const alertAccountIds = new Set(alerts?.map(a => a.ad_account_id) || [])

    // Formatar para o frontend
    const formattedBalances = (balances || []).map(b => ({
      // Campos esperados pela interface AdAccount
      client_id: b.client_id,
      client_name: b.clients?.name || 'Cliente Desconhecido',
      ad_account_id: b.ad_account_id,
      ad_account_name: b.ad_account_name || b.ad_account_id,
      balance: b.balance || 0,
      status: b.status || 'unknown',
      has_alert: alertAccountIds.has(b.ad_account_id),
      
      // Campos adicionais úteis
      account_id: b.ad_account_id,
      account_name: b.ad_account_name,
      currency: b.currency,
      daily_spend: b.daily_spend,
      account_spend_limit: b.spend_cap,
      last_updated: b.last_checked_at,
      projected_days_remaining: b.daily_spend > 0 ? b.balance / b.daily_spend : 999
    }))

    // Estatísticas
    const stats = {
      total_accounts: formattedBalances.length,
      total_balance: formattedBalances.reduce((sum, b) => sum + (b.balance || 0), 0),
      total_daily_spend: formattedBalances.reduce((sum, b) => sum + (b.daily_spend || 0), 0),
      critical_accounts: formattedBalances.filter(b => b.status === 'critical').length,
      warning_accounts: formattedBalances.filter(b => b.status === 'warning').length,
      healthy_accounts: formattedBalances.filter(b => b.status === 'healthy').length,
      last_check: balances?.[0]?.last_checked_at || null
    }

    return NextResponse.json({
      accounts: formattedBalances, // Mudado de 'balances' para 'accounts' para compatibilidade com frontend
      balances: formattedBalances, // Mantido para retrocompatibilidade
      summary: stats
    })

  } catch (error) {
    console.error('Erro na API de saldos:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
