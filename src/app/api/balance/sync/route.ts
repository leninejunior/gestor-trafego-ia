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
    console.log('📊 Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
    console.log('🔑 Service Role Key configurada:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)

    // Buscar todas as conexões Meta ativas (SEM JOIN para evitar erros)
    const { data: connections, error: connError } = await supabaseAdmin
      .from('client_meta_connections')
      .select('*')
      .eq('is_active', true)

    if (connError) {
      console.error('❌ Erro ao buscar conexões:', connError)
      return NextResponse.json({ 
        error: 'Erro ao buscar conexões',
        details: connError.message,
        code: connError.code
      }, { status: 500 })
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

    // Para cada conexão, buscar saldo da conta
    for (const connection of connections) {
      try {
        // Cada conexão tem UMA conta em ad_account_id
        const accountId = connection.ad_account_id
        
        if (!accountId) {
          console.log(`⚠️ Conexão ${connection.id} sem ad_account_id`)
          continue
        }
        
        console.log(`📊 Processando conta ${accountId} da conexão ${connection.id}`)
        
        try {
          // Buscar saldo REAL do Meta Ads
          const balance = await fetchRealBalance(accountId, connection.access_token)
          
          if (balance) {
            // Salvar no banco
            // Deletar registro existente
            await supabaseAdmin
              .from('ad_account_balances')
              .delete()
              .eq('client_id', connection.client_id)
              .eq('ad_account_id', accountId)

            // Inserir novo registro
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
              console.error(`Erro ao salvar saldo de ${accountId}:`, insertError)
              errors++
            } else {
              console.log(`✅ Saldo sincronizado: ${accountId} - ${balance.currency} ${balance.balance}`)
              synced++
            }
          }
        } catch (error) {
          console.error(`Erro ao processar conta ${accountId}:`, error)
          errors++
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
    // Buscar dados da conta do Meta Ads incluindo funding_source_details
    const url = `https://graph.facebook.com/v18.0/${accountId}?fields=name,currency,balance,amount_spent,spend_cap,funding_source_details&access_token=${accessToken}`
    
    const response = await fetch(url)
    
    if (!response.ok) {
      const error = await response.json()
      console.error(`Erro Meta API para ${accountId}:`, error)
      return null
    }

    const data = await response.json()

    // Extrair saldo real do display_string se disponível (inclui cupons/créditos)
    let realBalance = parseFloat(data.balance || '0') / 100
    let fundingSourceType = null
    let fundingSourceDisplay = null
    
    if (data.funding_source_details) {
      fundingSourceType = data.funding_source_details.type
      fundingSourceDisplay = data.funding_source_details.display_string
      
      // Tentar extrair o saldo do display_string (ex: "Saldo disponível (R$2.856,03 BRL)")
      const match = fundingSourceDisplay?.match(/R\$\s*([\d.,]+)/i)
      if (match) {
        const displayBalance = parseFloat(match[1].replace(/\./g, '').replace(',', '.'))
        if (!isNaN(displayBalance) && displayBalance > realBalance) {
          console.log(`💰 Saldo ajustado de R$ ${realBalance} para R$ ${displayBalance} (incluindo créditos)`)
          realBalance = displayBalance
        }
      }
    }

    // Converter valores (Meta retorna em centavos)
    const balance = realBalance
    const spendCap = parseFloat(data.spend_cap || '0') / 100
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
    } else if (balance < 50) {
      // Saldo muito baixo em valor absoluto
      status = 'critical'
    } else if (balance < 200) {
      // Saldo baixo em valor absoluto
      status = 'warning'
    } else if (spendCap > 0) {
      // Se tem spend_cap, verificar percentual
      const percentage = (balance / spendCap) * 100
      if (percentage < 10 || projectedDays < 3) {
        status = 'critical'
      } else if (percentage < 25 || projectedDays < 7) {
        status = 'warning'
      }
    } else if (projectedDays < 3) {
      // Sem spend_cap mas com projeção baixa
      status = 'critical'
    } else if (projectedDays < 7) {
      status = 'warning'
    }

    return {
      name: data.name || accountId,
      currency: data.currency || 'BRL',
      balance,
      spend_cap: spendCap,
      daily_spend_limit: 0, // Campo não existe na API do Meta
      amount_spent: amountSpent,
      daily_spend: dailySpend,
      projected_days: projectedDays,
      status,
      funding_source_type: fundingSourceType,
      funding_source_display: fundingSourceDisplay
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
