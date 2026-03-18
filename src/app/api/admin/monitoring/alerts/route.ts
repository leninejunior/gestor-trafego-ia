/**
 * Admin Monitoring Alerts API
 * 
 * Gerencia alertas do sistema de monitoramento
 * Requirements: 4.4, 8.3 - Gestão de alertas automáticos
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import AlertService from '@/lib/monitoring/alert-service'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verificar se o usuário é super admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
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

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const severity = searchParams.get('severity')
    const resolved = searchParams.get('resolved')

    // Construir query
    let query = supabase
      .from('alert_instances')
      .select(`
        id,
        rule_id,
        title,
        message,
        severity,
        metric_value,
        threshold,
        triggered_at,
        resolved_at,
        is_resolved,
        resolved_by,
        metadata,
        alert_rules!inner(name, description, metric)
      `)
      .order('triggered_at', { ascending: false })
      .limit(limit)

    if (severity) {
      query = query.eq('severity', severity)
    }

    if (resolved !== null) {
      query = query.eq('is_resolved', resolved === 'true')
    }

    const { data: alerts, error } = await query

    if (error) {
      console.error('Error fetching alerts:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // Estatísticas dos alertas
    const { data: statsData } = await supabase
      .from('alert_instances')
      .select('severity, is_resolved')
      .gte('triggered_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

    const stats = {
      total: statsData?.length || 0,
      active: statsData?.filter(a => !a.is_resolved).length || 0,
      resolved: statsData?.filter(a => a.is_resolved).length || 0,
      critical: statsData?.filter(a => a.severity === 'critical').length || 0,
      high: statsData?.filter(a => a.severity === 'high').length || 0,
      medium: statsData?.filter(a => a.severity === 'medium').length || 0,
      low: statsData?.filter(a => a.severity === 'low').length || 0
    }

    return NextResponse.json({
      alerts: alerts || [],
      stats,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error in alerts API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verificar se o usuário é super admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
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

    const body = await request.json()
    const { action, alert_id } = body

    const alertService = new AlertService()

    switch (action) {
      case 'resolve':
        if (!alert_id) {
          return NextResponse.json({ error: 'alert_id is required' }, { status: 400 })
        }
        
        await alertService.resolveAlert(alert_id, user.email || user.id)
        
        return NextResponse.json({
          success: true,
          message: 'Alert resolved successfully'
        })

      case 'check_all':
        await alertService.checkAllAlerts()
        
        return NextResponse.json({
          success: true,
          message: 'Alert check completed'
        })

      case 'initialize_defaults':
        await alertService.initializeDefaultAlerts()
        
        return NextResponse.json({
          success: true,
          message: 'Default alert rules initialized'
        })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in alerts POST API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verificar se o usuário é super admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
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

    const body = await request.json()
    const { alert_ids, action } = body

    if (!Array.isArray(alert_ids) || alert_ids.length === 0) {
      return NextResponse.json({ error: 'alert_ids array is required' }, { status: 400 })
    }

    switch (action) {
      case 'resolve_bulk':
        const { error } = await supabase
          .from('alert_instances')
          .update({
            is_resolved: true,
            resolved_at: new Date().toISOString(),
            resolved_by: user.email || user.id
          })
          .in('id', alert_ids)
          .eq('is_resolved', false)

        if (error) {
          console.error('Error resolving alerts:', error)
          return NextResponse.json({ error: 'Database error' }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          message: `${alert_ids.length} alerts resolved successfully`
        })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in alerts PATCH API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}