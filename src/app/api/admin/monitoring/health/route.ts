/**
 * API para health checks do sistema
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

    // Executar health checks
    const monitoringService = new MonitoringService()
    const healthChecks = await monitoringService.performAllHealthChecks()

    return NextResponse.json(healthChecks)
  } catch (error) {
    console.error('Error getting health checks:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}