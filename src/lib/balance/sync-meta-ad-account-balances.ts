import { createClient } from '@supabase/supabase-js'

type MetaConnection = {
  id: string
  client_id: string
  ad_account_id: string
  access_token: string
}

type MetaBalancePayload = {
  name: string
  currency: string
  balance: number
  spend_cap: number
  amount_spent: number
  daily_spend: number
  status: 'healthy' | 'warning' | 'critical'
  funding_source_type: string | null
  funding_source_display: string | null
}

export type BalanceSyncResult = {
  synced: number
  errors: number
  totalConnections: number
}

function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase environment variables are missing')
  }

  return createClient(supabaseUrl, serviceRoleKey)
}

export async function syncMetaAdAccountBalances(): Promise<BalanceSyncResult> {
  const supabaseAdmin = createSupabaseAdminClient()

  const { data: connections, error: connError } = await supabaseAdmin
    .from('client_meta_connections')
    .select('*')
    .eq('is_active', true)

  if (connError) {
    throw new Error(`Erro ao buscar conexoes: ${connError.message}`)
  }

  if (!connections || connections.length === 0) {
    return {
      synced: 0,
      errors: 0,
      totalConnections: 0
    }
  }

  let synced = 0
  let errors = 0

  for (const connection of connections as MetaConnection[]) {
    try {
      const accountId = connection.ad_account_id

      if (!accountId || !connection.client_id || !connection.access_token) {
        errors++
        continue
      }

      const balance = await fetchRealBalance(accountId, connection.access_token)
      if (!balance) {
        errors++
        continue
      }

      await supabaseAdmin
        .from('ad_account_balances')
        .delete()
        .eq('client_id', connection.client_id)
        .eq('ad_account_id', accountId)

      const { error: insertError } = await supabaseAdmin
        .from('ad_account_balances')
        .insert({
          client_id: connection.client_id,
          ad_account_id: accountId,
          ad_account_name: balance.name,
          balance: balance.balance,
          currency: balance.currency,
          status: balance.status,
          spend_cap: balance.spend_cap,
          amount_spent: balance.amount_spent,
          daily_spend: balance.daily_spend,
          funding_source_type: balance.funding_source_type,
          funding_source_display: balance.funding_source_display,
          last_checked_at: new Date().toISOString()
        })

      if (insertError) {
        errors++
      } else {
        synced++
      }
    } catch {
      errors++
    }
  }

  return {
    synced,
    errors,
    totalConnections: connections.length
  }
}

async function fetchRealBalance(accountId: string, accessToken: string): Promise<MetaBalancePayload | null> {
  try {
    const url = `https://graph.facebook.com/v18.0/${accountId}?fields=name,currency,balance,amount_spent,spend_cap,funding_source_details&access_token=${accessToken}`
    const response = await fetch(url)

    if (!response.ok) {
      return null
    }

    const data = await response.json()

    let realBalance = parseFloat(data.balance || '0') / 100
    let fundingSourceType: string | null = null
    let fundingSourceDisplay: string | null = null

    if (data.funding_source_details) {
      fundingSourceType = data.funding_source_details.type ?? null
      fundingSourceDisplay = data.funding_source_details.display_string ?? null

      const match = fundingSourceDisplay?.match(/R\$\s*([\d.,]+)/i)
      if (match) {
        const displayBalance = parseFloat(match[1].replace(/\./g, '').replace(',', '.'))
        if (!Number.isNaN(displayBalance) && displayBalance > realBalance) {
          realBalance = displayBalance
        }
      }
    }

    const balance = realBalance
    const spendCap = parseFloat(data.spend_cap || '0') / 100
    const amountSpent = parseFloat(data.amount_spent || '0') / 100

    const insightsUrl = `https://graph.facebook.com/v18.0/${accountId}/insights?fields=spend&time_range={"since":"${getDateDaysAgo(7)}","until":"${getDateDaysAgo(0)}"}&access_token=${accessToken}`

    let dailySpend = 0
    const insightsResponse = await fetch(insightsUrl)
    if (insightsResponse.ok) {
      const insightsData = await insightsResponse.json()
      const totalSpend = insightsData.data?.reduce((sum: number, day: { spend?: string }) => {
        return sum + parseFloat(day.spend || '0')
      }, 0) || 0
      dailySpend = totalSpend / 7
    }

    const projectedDays = dailySpend > 0 ? Math.floor(balance / dailySpend) : 999

    let status: 'healthy' | 'warning' | 'critical' = 'healthy'
    if (balance <= 0) {
      status = 'critical'
    } else if (balance < 50) {
      status = 'critical'
    } else if (balance < 200) {
      status = 'warning'
    } else if (spendCap > 0) {
      const percentage = (balance / spendCap) * 100
      if (percentage < 10 || projectedDays < 3) {
        status = 'critical'
      } else if (percentage < 25 || projectedDays < 7) {
        status = 'warning'
      }
    } else if (projectedDays < 3) {
      status = 'critical'
    } else if (projectedDays < 7) {
      status = 'warning'
    }

    return {
      name: data.name || accountId,
      currency: data.currency || 'BRL',
      balance,
      spend_cap: spendCap,
      amount_spent: amountSpent,
      daily_spend: dailySpend,
      status,
      funding_source_type: fundingSourceType,
      funding_source_display: fundingSourceDisplay
    }
  } catch {
    return null
  }
}

function getDateDaysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().split('T')[0]
}
