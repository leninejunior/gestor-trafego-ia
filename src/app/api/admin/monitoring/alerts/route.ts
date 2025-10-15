/**
 * API para alertas do sistema
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import MonitoringService from '@/lib/monitoring/monitoring-service'

export async function GET(request: NextRequest) {
  try {
    // Verificar se é super admin
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!userRole || userRole.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Buscar alertas
    const monitoringService = new MonitoringService()
    const alerts = await monitoringService.getActiveAlerts()

    return NextResponse.json(alerts)
  } catch (error) {
    console.error('Error getting alerts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verificar se é super admin
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!userRole || userRole.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { alertId, action } = await request.json()

    if (action === 'resolve') {
      const monitoringService = new MonitoringService()
      await monitoringService.resolveAlert(alertId, user.id)
      
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error handling alert action:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}