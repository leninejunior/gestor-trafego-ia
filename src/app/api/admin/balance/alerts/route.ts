/**
 * API para Alertas de Saldo - Admin
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Buscar alertas do banco de dados
    const { data: alerts, error: alertsError } = await supabase
      .from('balance_alerts')
      .select(`
        *,
        clients (
          id,
          name,
          organization_id
        )
      `)
      .order('created_at', { ascending: false })

    if (alertsError) {
      console.error('Error fetching alerts:', alertsError)
      return NextResponse.json({ error: 'Error fetching alerts' }, { status: 500 })
    }

    // Formatar alertas para o frontend
    const formattedAlerts = (alerts || []).map(alert => ({
      id: alert.id,
      account_id: alert.ad_account_id,
      account_name: alert.ad_account_name,
      threshold_percentage: 20, // Calcular baseado no threshold_amount
      threshold_amount: alert.threshold_amount,
      is_active: alert.is_active,
      notification_email: true,
      notification_push: true,
      notification_sms: false,
      created_at: alert.created_at,
      last_triggered: alert.last_alert_sent_at,
      current_balance: alert.current_balance,
      alert_type: alert.alert_type,
      client_name: alert.clients?.name
    }))

    return NextResponse.json({
      alerts: formattedAlerts,
      summary: {
        total_alerts: formattedAlerts.length,
        active_alerts: formattedAlerts.filter(a => a.is_active).length,
        inactive_alerts: formattedAlerts.filter(a => !a.is_active).length
      }
    })

  } catch (error) {
    console.error('Error fetching alerts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      account_id,
      client_id,
      threshold_percentage,
      threshold_amount,
      notification_email,
      notification_push,
      notification_sms
    } = body

    // Validação
    if (!account_id || !client_id || !threshold_amount) {
      return NextResponse.json(
        { error: 'Missing required fields: account_id, client_id, threshold_amount' },
        { status: 400 }
      )
    }

    // Buscar informações da conta
    const { data: metaAccount } = await supabase
      .from('meta_ad_accounts')
      .select('ad_account_name')
      .eq('ad_account_id', account_id)
      .single()

    // Criar alerta no banco
    const { data: newAlert, error: insertError } = await supabase
      .from('balance_alerts')
      .insert({
        client_id,
        ad_account_id: account_id,
        ad_account_name: metaAccount?.ad_account_name || 'Conta sem nome',
        threshold_amount,
        alert_type: 'low_balance',
        is_active: true
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating alert:', insertError)
      return NextResponse.json(
        { error: 'Error creating alert' },
        { status: 500 }
      )
    }

    console.log('Created balance alert:', newAlert)

    return NextResponse.json({
      success: true,
      alert: newAlert,
      message: 'Alert created successfully'
    })

  } catch (error) {
    console.error('Error creating alert:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}