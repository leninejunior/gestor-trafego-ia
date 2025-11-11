/**
 * API para Sincronizar Saldo Real do Meta Ads
 * Busca saldo direto da API do Meta e atualiza o banco
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Iniciando sincronização de saldo...')

    // Buscar todas as conexões Meta ativas
    const { data: connections, error: connError } = await supabaseAdmin
      .from('client_meta_connections')
      .select(`
        *,
        clients (
          id,
          name
        )
      `)
      .eq('status', 'active')

    if (connError) {
      console.error('Erro ao buscar conexões:', connError)
      return NextResponse.json({ error: 'Erro ao buscar conexões' }, { status: 500 })
    }

    if (!connections || connections.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhuma conexão Meta encontrada',
        synced: 0
      })
    }

    console.log(`📊 Encontradas ${connections.length} conexões`)

    let synced = 0
    let errors = 0

    // Para cada conexão, buscar saldo das contas
    for (const connection of connections) {
      try {
        const accountIds = connection.selected_ad_account_ids || []
        
        for (const accountId of accountIds) {
          try {
            // Buscar saldo REAL do Meta Ads
            const balance = await fetchRealBalance(accountId, connection.access_token)
            
            if (balance) {
              // Salvar no banco
              const { error: upsertError } = await supabaseAdmin
                .from('ad_account_balances')
                .upsert({
                  client_id: connection.clients.id,
                  ad_account_id: accountId,
                  ad_account_name: balance.name,
                  balance: balance.balance,
                  spend_cap: balance.spend_cap,
                  daily_spend_limit: balance.daily_spend_limit,
                  currency: balance.currency,
                  daily_spend: balance.daily_spend,
                  projected_days_remaining: balance.projected_days,
                  status: balance.status,
                  last_updated: new Date().toISOString()
                }, {
                  onConflict: 'client_id,ad_account_id'
                })

              if (upsertError) {
                console.error(`Erro ao salvar saldo de ${accountId}:`, upsertError)
                errors++
              } else {
                console.log(`✅ Saldo sincronizado: ${accountId} - R$ ${balance.balance}`)
                synced++
              }
            }
          } catch (error) {
            console.error(`Erro ao processar conta ${accountId}:`, error)
            errors++
          }
        }
      } catch (error) {
        console.error(`Erro ao processar conexão ${connection.id}:`, error)
        errors++
      }
    }

    return NextResponse.json({
      success: true,
      message: `Sincronização concluída: ${synced} contas atualizadas`,
      synced,
      errors,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Erro na sincronização:', error)
    return NextResponse.json({
      error: 'Erro interno na sincronização',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function fetchRealBalance(accountId: string, accessToken: string) {
  try {
    // Buscar dados da conta do Meta Ads
    const url = `https://graph.facebook.com/v18.0/${accountId}?fields=name,currency,balance,amount_spent,spend_cap,daily_spend_limit&access_token=${accessToken}`
    
    const response = await fetch(url)
    
    if (!response.ok) {
      const error = await response.json()
      console.error(`Erro Meta API para ${accountId}:`, error)
      return null
    }

    const data = await response.json()

    // Converter valores (Meta retorna em centavos)
    const balance = parseFloat(data.balance || '0') / 100
    const spendCap = parseFloat(data.spend_cap || '0') / 100
    const dailySpendLimit = parseFloat(data.daily_spend_limit || '0') / 100
    const amountSpent = parseFloat(data.amount_spent || '0') / 100

    // Buscar gasto dos últimos 7 dias
    const insightsUrl = `https://graph.facebook.com/v18.0/${accountId}/insights?fields=spend&time_range={"since":"${getDateDaysAgo(7)}","until":"${getDateDaysAgo(0)}"}&access_token=${accessToken}`
    
    let dailySpend = 0
    try {
      const insightsResponse = await fetch(insightsUrl)
      if (insightsResponse.ok) {
        const insightsData = await insightsResponse.json()
        const totalSpend = insightsData.data?.reduce((sum: number, day: any) => 
          sum + parseFloat(day.spend || '0'), 0) || 0
        dailySpend = totalSpend / 7
      }
    } catch (err) {
      console.error('Erro ao buscar insights:', err)
    }

    // Calcular projeção e status
    const projectedDays = dailySpend > 0 ? Math.floor(balance / dailySpend) : 999
    
    let status = 'healthy'
    if (balance <= 0) {
      status = 'critical'
    } else if (spendCap > 0) {
      const percentage = (balance / spendCap) * 100
      if (percentage < 20 || projectedDays < 3) {
        status = 'critical'
      } else if (percentage < 40 || projectedDays < 7) {
        status = 'warning'
      }
    }

    return {
      name: data.name || accountId,
      currency: data.currency || 'BRL',
      balance,
      spend_cap: spendCap,
      daily_spend_limit: dailySpendLimit,
      amount_spent: amountSpent,
      daily_spend: dailySpend,
      projected_days: projectedDays,
      status
    }

  } catch (error) {
    console.error(`Erro ao buscar saldo de ${accountId}:`, error)
    return null
  }
}

function getDateDaysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().split('T')[0]
}
