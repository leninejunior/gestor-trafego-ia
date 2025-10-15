/**
 * API para Alerta Individual de Saldo - Admin
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ alertId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verificar se é super admin
    const { data: userRole } = await supabase
      .from('memberships')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!userRole || !userRole.role?.includes('super_admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { alertId } = await params
    const body = await request.json()

    // Simular atualização do alerta (em produção, atualizaria no banco)
    console.log(`Updating alert ${alertId} with:`, body)

    return NextResponse.json({
      success: true,
      message: 'Alert updated successfully',
      alertId,
      updates: body,
      updated_at: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error updating alert:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ alertId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verificar se é super admin
    const { data: userRole } = await supabase
      .from('memberships')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!userRole || !userRole.role?.includes('super_admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { alertId } = await params

    // Simular exclusão do alerta (em produção, removeria do banco)
    console.log(`Deleting alert ${alertId}`)

    return NextResponse.json({
      success: true,
      message: 'Alert deleted successfully',
      alertId,
      deleted_at: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error deleting alert:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}