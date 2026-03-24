import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  createApiError,
  createApiSuccess,
  requireApiKey,
  toNumber,
  validateClientScope
} from '../_lib/api-v1-utils'

export async function GET(request: NextRequest) {
  const authResult = await requireApiKey(request, 'balance:read')
  if (authResult.ok === false) {
    return authResult.response
  }

  const clientId = request.nextUrl.searchParams.get('client_id')?.trim()
  if (!clientId) {
    return createApiError(400, 'MISSING_CLIENT_ID', 'Query parameter client_id is required')
  }

  try {
    const scopedClient = await validateClientScope(clientId, authResult.auth.organizationId)
    if (!scopedClient.ok) {
      return scopedClient.response
    }

    const supabase = createServiceClient()
    const { data: accounts, error } = await supabase
      .from('ad_account_balances')
      .select('client_id, ad_account_id, ad_account_name, currency, balance, daily_spend, spend_cap, status, last_checked_at')
      .eq('client_id', clientId)
      .order('status', { ascending: false })
      .order('balance', { ascending: true })

    if (error) {
      console.error('[v1/balance] fetch error:', error)
      return createApiError(500, 'BALANCE_FETCH_FAILED', 'Failed to fetch account balances')
    }

    const rows = (accounts ?? []).map((row: any) => ({
      ad_account_id: row.ad_account_id,
      ad_account_name: row.ad_account_name,
      currency: row.currency ?? 'BRL',
      balance: Number(toNumber(row.balance).toFixed(2)),
      daily_spend: Number(toNumber(row.daily_spend).toFixed(2)),
      spend_cap: Number(toNumber(row.spend_cap).toFixed(2)),
      status: row.status ?? 'unknown',
      last_checked_at: row.last_checked_at
    }))

    const summary = {
      total_accounts: rows.length,
      total_balance: Number(rows.reduce((acc, row) => acc + row.balance, 0).toFixed(2)),
      total_daily_spend: Number(rows.reduce((acc, row) => acc + row.daily_spend, 0).toFixed(2)),
      critical_accounts: rows.filter((row) => row.status === 'critical').length,
      warning_accounts: rows.filter((row) => row.status === 'warning').length,
      healthy_accounts: rows.filter((row) => row.status === 'healthy').length
    }

    return createApiSuccess(
      {
        client_id: clientId,
        client_name: scopedClient.client.name ?? null,
        accounts: rows,
        summary
      },
      { warnings: [] }
    )
  } catch (error) {
    console.error('[v1/balance] unexpected error:', error)
    return createApiError(500, 'INTERNAL_SERVER_ERROR', 'Internal server error')
  }
}

