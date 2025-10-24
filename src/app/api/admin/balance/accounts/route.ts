/**
 * API: Buscar saldos das contas de anúncios
 * GET /api/admin/balance/accounts
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Buscar conexões Meta ativas do usuário
    const { data: connections, error: connectionsError } = await supabase
      .from('meta_ad_accounts')
      .select(`
        *,
        clients (
          id,
          name,
          organization_id
        )
      `)
      .eq('is_active', true)

    if (connectionsError) {
      console.error('Error fetching connections:', connectionsError)
      return NextResponse.json({ error: 'Erro ao buscar conexões' }, { status: 500 })
    }

    if (!connections || connections.length === 0) {
      return NextResponse.json({ balances: [] })
    }

    // Buscar saldo de cada conta via Meta API
    const balances = await Promise.all(
      connections.map(async (connection) => {
        try {
          // Buscar saldo atual da conta via Meta API
          const accountId = connection.ad_account_id
          const accessToken = connection.access_token

          const response = await fetch(
            `https://graph.facebook.com/v18.0/${accountId}?fields=account_id,name,currency,balance,amount_spent,spend_cap,daily_spend_limit,account_status&access_token=${accessToken}`,
            { next: { revalidate: 300 } } // Cache por 5 minutos
          )

          if (!response.ok) {
            console.error(`Error fetching balance for ${accountId}:`, await response.text())
            return null
          }

          const accountData = await response.json()

          // Calcular métricas
          const balance = parseFloat(accountData.balance) / 100 // Meta retorna em centavos
          const amountSpent = parseFloat(accountData.amount_spent) / 100
          const spendCap = accountData.spend_cap ? parseFloat(accountData.spend_cap) / 100 : 0
          const dailySpendLimit = accountData.daily_spend_limit ? parseFloat(accountData.daily_spend_limit) / 100 : 0

          // Buscar gasto dos últimos 7 dias para calcular média diária
          const insightsResponse = await fetch(
            `https://graph.facebook.com/v18.0/${accountId}/insights?fields=spend&time_range={"since":"${getDateDaysAgo(7)}","until":"${getDateDaysAgo(0)}"}&access_token=${accessToken}`
          )

          let dailySpend = 0
          if (insightsResponse.ok) {
            const insightsData = await insightsResponse.json()
            if (insightsData.data && insightsData.data.length > 0) {
              const totalSpend = insightsData.data.reduce((sum: number, day: any) => sum + parseFloat(day.spend || 0), 0)
              dailySpend = totalSpend / 7
            }
          }

          // Calcular dias restantes
          const projectedDaysRemaining = dailySpend > 0 ? balance / dailySpend : 999

          // Determinar status
          let status: 'healthy' | 'warning' | 'critical' = 'healthy'
          const balancePercentage = spendCap > 0 ? (balance / spendCap) * 100 : 100

          if (balance <= 0 || balancePercentage < 10) {
            status = 'critical'
          } else if (balancePercentage < 20 || projectedDaysRemaining < 3) {
            status = 'warning'
          }

          return {
            account_id: accountData.account_id,
            account_name: accountData.name,
            currency: accountData.currency,
            balance,
            daily_spend_limit: dailySpendLimit,
            account_spend_limit: spendCap || balance * 2, // Se não tem limite, usa 2x o saldo
            current_spend: amountSpent,
            daily_spend: dailySpend,
            projected_days_remaining: projectedDaysRemaining,
            status,
            last_updated: new Date().toISOString(),
            client_name: connection.clients?.name,
            account_status: accountData.account_status
          }
        } catch (error) {
          console.error(`Error processing account ${connection.ad_account_id}:`, error)
          return null
        }
      })
    )

    // Filtrar contas com erro
    const validBalances = balances.filter(b => b !== null)

    // Atualizar balance_alerts com os valores atuais
    for (const balance of validBalances) {
      if (balance) {
        await supabase
          .from('balance_alerts')
          .upsert({
            ad_account_id: balance.account_id,
            ad_account_name: balance.account_name,
            current_balance: balance.balance,
            last_checked_at: new Date().toISOString()
          }, {
            onConflict: 'ad_account_id',
            ignoreDuplicates: false
          })
      }
    }

    return NextResponse.json({ 
      balances: validBalances,
      total_accounts: validBalances.length,
      critical_accounts: validBalances.filter(b => b?.status === 'critical').length,
      warning_accounts: validBalances.filter(b => b?.status === 'warning').length
    })

  } catch (error) {
    console.error('Error in balance accounts API:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar saldos das contas' },
      { status: 500 }
    )
  }
}

// Helper: Obter data X dias atrás no formato YYYY-MM-DD
function getDateDaysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().split('T')[0]
}
