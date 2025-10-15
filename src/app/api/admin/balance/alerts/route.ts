/**
 * API para Alertas de Saldo - Admin
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

    // Simular alertas configurados (em produção, viria do banco)
    const alerts = [
      {
        id: 'alert_1',
        account_id: 'act_123456789',
        account_name: 'Conta Principal - Loja Online',
        threshold_percentage: 20,
        threshold_amount: 1000,
        is_active: true,
        notification_email: true,
        notification_push: true,
        notification_sms: false,
        created_at: '2024-12-01T10:00:00Z',
        last_triggered: '2024-12-15T14:30:00Z'
      },
      {
        id: 'alert_2',
        account_id: 'act_987654321',
        account_name: 'Conta Secundária - App Mobile',
        threshold_percentage: 15,
        threshold_amount: 500,
        is_active: true,
        notification_email: true,
        notification_push: false,
        notification_sms: true,
        created_at: '2024-11-15T09:00:00Z',
        last_triggered: null
      },
      {
        id: 'alert_3',
        account_id: 'act_456789123',
        account_name: 'Conta Teste - Campanhas Sazonais',
        threshold_percentage: 25,
        threshold_amount: 2000,
        is_active: false,
        notification_email: true,
        notification_push: true,
        notification_sms: false,
        created_at: '2024-10-20T16:00:00Z',
        last_triggered: '2024-11-30T11:15:00Z'
      }
    ]

    return NextResponse.json({
      alerts,
      summary: {
        total_alerts: alerts.length,
        active_alerts: alerts.filter(a => a.is_active).length,
        inactive_alerts: alerts.filter(a => !a.is_active).length
      }
    })

  } catch (error) {
    console.error('Error fetching alerts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const {
      account_id,
      threshold_percentage,
      threshold_amount,
      notification_email,
      notification_push,
      notification_sms
    } = body

    // Validação
    if (!account_id || (!threshold_percentage && !threshold_amount)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Simular criação do alerta (em produção, salvaria no banco)
    const newAlert = {
      id: `alert_${Date.now()}`,
      account_id,
      threshold_percentage: threshold_percentage || 0,
      threshold_amount: threshold_amount || 0,
      is_active: true,
      notification_email: notification_email || false,
      notification_push: notification_push || false,
      notification_sms: notification_sms || false,
      created_at: new Date().toISOString(),
      created_by: user.id
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