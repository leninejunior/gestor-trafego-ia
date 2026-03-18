/**
 * API para Histórico de Saldo e Gastos
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

    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get('days') || '30')
    const accountId = searchParams.get('account_id')

    // Buscar histórico de alertas (proxy para histórico de saldo)
    let query = supabase
      .from('alert_history')
      .select(`
        *,
        balance_alerts (
          ad_account_id,
          ad_account_name,
          client_id,
          clients (
            name
          )
        )
      `)
      .gte('sent_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .order('sent_at', { ascending: false })

    if (accountId) {
      query = query.eq('balance_alerts.ad_account_id', accountId)
    }

    const { data: history, error: historyError } = await query

    if (historyError) {
      console.error('Error fetching history:', historyError)
      return NextResponse.json({ error: 'Error fetching history' }, { status: 500 })
    }

    // Formatar dados para o frontend
    const formattedHistory = (history || []).map(item => ({
      date: item.sent_at,
      account_id: item.balance_alerts?.ad_account_id,
      account_name: item.balance_alerts?.ad_account_name,
      client_name: item.balance_alerts?.clients?.name,
      balance: item.balance_at_send,
      threshold: item.threshold_at_send,
      alert_type: item.sent_via,
      status: item.status
    }))

    // Agrupar por data para gráficos
    const dailyData = formattedHistory.reduce((acc: any, item) => {
      const date = new Date(item.date).toISOString().split('T')[0]
      
      if (!acc[date]) {
        acc[date] = {
          date,
          total_alerts: 0,
          critical_alerts: 0,
          warning_alerts: 0,
          accounts: new Set()
        }
      }

      acc[date].total_alerts++
      if (item.balance <= 0) {
        acc[date].critical_alerts++
      } else {
        acc[date].warning_alerts++
      }
      acc[date].accounts.add(item.account_id)

      return acc
    }, {})

    const chartData = Object.values(dailyData).map((day: any) => ({
      ...day,
      accounts: day.accounts.size
    }))

    return NextResponse.json({
      history: formattedHistory,
      chart_data: chartData,
      summary: {
        total_alerts: formattedHistory.length,
        unique_accounts: new Set(formattedHistory.map(h => h.account_id)).size,
        critical_alerts: formattedHistory.filter(h => h.balance <= 0).length,
        warning_alerts: formattedHistory.filter(h => h.balance > 0).length
      }
    })

  } catch (error) {
    console.error('Error in balance history API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
