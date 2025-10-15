/**
 * API para Saldos de Contas - Admin
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

    // Buscar contas Meta Ads
    const { data: accounts, error: accountsError } = await supabase
      .from('meta_accounts')
      .select(`
        id,
        name,
        currency,
        account_status,
        organization_id
      `)

    if (accountsError) {
      console.error('Error fetching accounts:', accountsError)
      return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 })
    }

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ balances: [] })
    }

    // Simular dados de saldo (em produção, viria da Meta API)
    const balances = accounts.map(account => {
      // Simular valores realistas
      const accountSpendLimit = 10000 + Math.random() * 40000 // R$ 10k - 50k
      const balance = accountSpendLimit * (0.1 + Math.random() * 0.8) // 10% - 90% do limite
      const dailySpendLimit = accountSpendLimit * 0.1 // 10% do limite mensal
      const dailySpend = dailySpendLimit * (0.3 + Math.random() * 0.6) // 30% - 90% do limite diário
      const currentSpend = accountSpendLimit * (0.1 + Math.random() * 0.4) // Gasto atual do mês
      
      // Calcular projeção de dias restantes
      const projectedDaysRemaining = dailySpend > 0 ? balance / dailySpend : 999

      // Determinar status baseado no percentual de saldo
      const balancePercentage = (balance / accountSpendLimit) * 100
      let status: 'healthy' | 'warning' | 'critical'
      
      if (balancePercentage >= 50) {
        status = 'healthy'
      } else if (balancePercentage >= 20) {
        status = 'warning'
      } else {
        status = 'critical'
      }

      return {
        account_id: account.id,
        account_name: account.name,
        currency: account.currency || 'BRL',
        balance: Math.round(balance * 100) / 100,
        daily_spend_limit: Math.round(dailySpendLimit * 100) / 100,
        account_spend_limit: Math.round(accountSpendLimit * 100) / 100,
        current_spend: Math.round(currentSpend * 100) / 100,
        daily_spend: Math.round(dailySpend * 100) / 100,
        projected_days_remaining: Math.round(projectedDaysRemaining * 10) / 10,
        status,
        last_updated: new Date().toISOString()
      }
    })

    return NextResponse.json({
      balances,
      summary: {
        total_accounts: balances.length,
        healthy_accounts: balances.filter(b => b.status === 'healthy').length,
        warning_accounts: balances.filter(b => b.status === 'warning').length,
        critical_accounts: balances.filter(b => b.status === 'critical').length,
        total_balance: balances.reduce((sum, b) => sum + b.balance, 0),
        total_daily_spend: balances.reduce((sum, b) => sum + b.daily_spend, 0)
      }
    })

  } catch (error) {
    console.error('Error fetching balance data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}