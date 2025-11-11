/**
 * API para Verificar Saldo de TODAS as Contas
 * Roda a cada 5 minutos via Cron ou chamada manual
 * NÃO requer autenticação (uso interno/admin)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Cliente Supabase com service role (sem RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export const runtime = 'edge'
export const maxDuration = 300

export async function GET(request: NextRequest) {
  try {
    // Verificar chave de segurança (opcional mas recomendado)
    const authHeader = request.headers.get('authorization')
    const apiKey = process.env.BALANCE_CHECK_API_KEY || process.env.CRON_SECRET

    if (apiKey && authHeader !== `Bearer ${apiKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🔍 Iniciando verificação de saldo de todas as contas...')

    // Buscar TODAS as conexões Meta ativas (sem RLS)
    const { data: connections, error: connectionsError } = await supabaseAdmin
      .from('client_meta_connections')
      .select('*')
      .eq('status', 'active')

    if (connectionsError) {
      console.error('Erro ao buscar conexões:', connectionsError)
      return NextResponse.json({ 
        error: 'Erro ao buscar conexões',
        details: connectionsError.message 
      }, { status: 500 })
    }

    console.log(`✅ Encontradas ${connections?.length || 0} conexões ativas`)

    const results = {
      total_connections: connections?.length || 0,
      accounts_checked: 0,
      accounts_updated: 0,
      alerts_triggered: 0,
      errors: 0,
      accounts: [] as any[]
    }

    // Verificar cada conexão
    for (const connection of connections || []) {
      try {
        const accountIds = connection.selected_ad_account_ids || []
        
        for (const accountId of accountIds) {
          results.accounts_checked++

          // Buscar saldo da conta
          const balance = await fetchAccountBalance(accountId, connection.access_token)
          
          if (balance) {
            // Atualizar ou criar registro de saldo
            const { error: upsertError } = await supabaseAdmin
              .from('ad_account_balances')
              .upsert({
                ad_account_id: accountId,
                ad_account_name: balance.name,
                client_id: connection.client_id,
                currency: balance.currency,
                balance: balance.balance,
                daily_spend: balance.daily_spend,
                account_spend_limit: balance.spend_cap,
                status: balance.status,
                last_checked_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'ad_account_id'
              })

            if (upsertError) {
              console.error(`Erro ao atualizar ${accountId}:`, upsertError)
              results.errors++
            } else {
              results.accounts_updated++
              results.accounts.push({
                account_id: accountId,
                balance: balance.balance,
                status: balance.status
              })

              // Verificar se precisa disparar alerta
              if (balance.status === 'critical') {
                results.alerts_triggered++
                console.log(`🚨 Alerta crítico: ${accountId} - Saldo: ${balance.balance}`)
              }
            }
          }
        }
      } catch (error) {
        console.error(`Erro ao processar conexão ${connection.id}:`, error)
        results.errors++
      }
    }

    console.log('✅ Verificação concluída:', results)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results
    })

  } catch (error) {
    console.error('❌ Erro na verificação de saldo:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

async function fetchAccountBalance(accountId: string, accessToken: string) {
  try {
    const url = `https://graph.facebook.com/v18.0/${accountId}?fields=name,currency,balance,amount_spent,spend_cap,daily_spend_limit&access_token=${accessToken}`
    
    const response = await fetch(url)
    
    if (!response.ok) {
      console.error(`Erro ao buscar ${accountId}:`, response.statusText)
      return null
    }

    const data = await response.json()

    const balance = parseFloat(data.balance || '0') / 100
    const dailySpend = parseFloat(data.amount_spent || '0') / 100
    const spendCap = parseFloat(data.spend_cap || '0') / 100

    // Determinar status
    let status = 'healthy'
    if (balance <= 0) {
      status = 'critical'
    } else if (spendCap > 0 && (balance / spendCap) < 0.2) {
      status = 'critical'
    } else if (spendCap > 0 && (balance / spendCap) < 0.4) {
      status = 'warning'
    }

    return {
      name: data.name || 'Conta sem nome',
      currency: data.currency || 'BRL',
      balance,
      daily_spend: dailySpend,
      spend_cap: spendCap,
      status
    }

  } catch (error) {
    console.error(`Erro ao buscar saldo ${accountId}:`, error)
    return null
  }
}

// Permitir POST também
export async function POST(request: NextRequest) {
  return GET(request)
}
