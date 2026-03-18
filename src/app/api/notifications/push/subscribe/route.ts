/**
 * API para registrar push subscriptions
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import PushService from '@/lib/notifications/push-service'

export async function POST(request: NextRequest) {
  try {
    const { subscription, organizationId } = await request.json()

    // Verificar autenticação
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verificar se o usuário pertence à organização
    const { data: membership } = await supabase
      .from('organization_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Registrar subscription
    const pushService = new PushService()
    const success = await pushService.registerPushSubscription(
      user.id,
      organizationId,
      subscription
    )

    if (success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ error: 'Failed to register subscription' }, { status: 500 })
    }
  } catch (error) {
    console.error('Error registering push subscription:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { endpoint } = await request.json()

    // Verificar autenticação
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Remover subscription
    const pushService = new PushService()
    const success = await pushService.unregisterPushSubscription(endpoint)

    if (success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ error: 'Failed to unregister subscription' }, { status: 500 })
    }
  } catch (error) {
    console.error('Error unregistering push subscription:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}