/**
 * API: Histórico de gastos das contas
 * GET /api/admin/balance/history?days=30
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get('days') || '30')

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Buscar conexões Meta ativas
    const { data: connections, error: connectionsError } = await supabase
      .from('meta_ad_accounts')
      .select('ad_account_id, access_token')
      .eq('is_active', true)

    if (connectionsError || !connections || connections.length === 0) {
      return NextResponse.json({ history: [] })
    }

    // Buscar histórico de cada conta
    const allHistory = await Promise.all(
      connections.map(async (connection) => {
        try {
          const accountId = connection.ad_account_id
          const accessToken = connection.access_token

          // Buscar insights diários
          const response = await fetch(
            `https://graph.facebook.com/v18.0/${accountId}/insights?` +
            `fields=spend,date_start&` +
            `time_range={"since":"${getDateDaysAgo(days)}","until":"${getDateDaysAgo(0)}"}&` +
            `time_increment=1&` +
            `access_token=${accessToken}`,
            { next: { revalidate: 3600 } } // Cache por 1 hora
          )

          if (!response.ok) {
            console.error(`Error fetching history for ${accountId}`)
            return []
          }

          const data = await response.json()

          return (data.data || []).map((day: any) => ({
            date: day.date_start,
            spend: parseFloat(day.spend || 0),
            account_id: accountId
          }))
        } catch (error) {
          console.error(`Error processing history for ${connection.ad_account_id}:`, error)
          return []
        }
      })
    )

    // Flatten e ordenar por data
    const history = allHistory
      .flat()
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Agregar por data (somar gastos de todas as contas)
    const aggregated = history.reduce((acc: any[], item) => {
      const existing = acc.find(h => h.date === item.date)
      if (existing) {
        existing.spend += item.spend
        existing.accounts.push(item.account_id)
      } else {
        acc.push({
          date: item.date,
          spend: item.spend,
          accounts: [item.account_id]
        })
      }
      return acc
    }, [])

    return NextResponse.json({ 
      history: aggregated,
      total_days: days,
      total_spend: aggregated.reduce((sum, day) => sum + day.spend, 0)
    })

  } catch (error) {
    console.error('Error in balance history API:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar histórico de gastos' },
      { status: 500 }
    )
  }
}

function getDateDaysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().split('T')[0]
}
