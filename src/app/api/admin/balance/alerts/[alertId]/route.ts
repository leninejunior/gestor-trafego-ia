/**
 * API para Gerenciar Alerta Específico
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { alertId: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const alertId = params.alertId
    const body = await request.json()

    // Atualizar alerta no banco
    const { data: updatedAlert, error: updateError } = await supabase
      .from('balance_alerts')
      .update({
        is_active: body.is_active,
        threshold_amount: body.threshold_amount,
        updated_at: new Date().toISOString()
      })
      .eq('id', alertId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating alert:', updateError)
      return NextResponse.json({ error: 'Error updating alert' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      alert: updatedAlert
    })

  } catch (error) {
    console.error('Error in PATCH alert:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { alertId: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const alertId = params.alertId

    // Deletar alerta do banco
    const { error: deleteError } = await supabase
      .from('balance_alerts')
      .delete()
      .eq('id', alertId)

    if (deleteError) {
      console.error('Error deleting alert:', deleteError)
      return NextResponse.json({ error: 'Error deleting alert' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Alert deleted successfully'
    })

  } catch (error) {
    console.error('Error in DELETE alert:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
