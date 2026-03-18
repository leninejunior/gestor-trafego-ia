/**
 * API para enviar push notifications
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import PushService from '@/lib/notifications/push-service'

export async function POST(request: NextRequest) {
  try {
    const { 
      target, // 'user' | 'organization'
      targetId, // userId ou organizationId
      title,
      body,
      icon,
      data,
      actions
    } = await request.json()

    // Verificar autenticação
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verificar permissões (apenas admins podem enviar para organização)
    if (target === 'organization') {
      const { data: membership } = await supabase
        .from('organization_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('organization_id', targetId)
        .single()

      if (!membership || !['owner', 'admin'].includes(membership.role)) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
      }
    }

    const pushService = new PushService()
    const payload = {
      title,
      body,
      icon: icon || '/icon-192x192.png',
      data,
      actions
    }

    let result
    if (target === 'user') {
      result = await pushService.sendPushToUser(targetId, payload)
    } else {
      result = await pushService.sendPushToOrganization(targetId, payload, user.id)
    }

    return NextResponse.json({
      success: true,
      sent: result.success,
      failed: result.failed
    })
  } catch (error) {
    console.error('Error sending push notification:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}