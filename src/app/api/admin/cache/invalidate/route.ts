import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { UserAccessCacheInvalidator } from '@/lib/services/user-access-cache'

/**
 * Cache Invalidation API
 * 
 * POST /api/admin/cache/invalidate - Invalidate specific cache entries
 * 
 * Body options:
 * - { type: 'user', userId: string }
 * - { type: 'organization', orgId: string }
 * - { type: 'client_access', userId: string, clientId?: string }
 * - { type: 'subscription', orgId: string }
 */

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type, userId, orgId, clientId } = body

    let invalidatedCount = 0
    let message = ''

    switch (type) {
      case 'user':
        if (!userId) {
          return NextResponse.json({ error: 'userId is required' }, { status: 400 })
        }
        await UserAccessCacheInvalidator.afterUserTypeChange(userId)
        message = `Invalidated cache for user ${userId}`
        break

      case 'organization':
        if (!orgId) {
          return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
        }
        await UserAccessCacheInvalidator.afterSubscriptionChange(orgId)
        message = `Invalidated cache for organization ${orgId}`
        break

      case 'client_access':
        if (!userId) {
          return NextResponse.json({ error: 'userId is required' }, { status: 400 })
        }
        await UserAccessCacheInvalidator.afterClientAccessChange(userId, clientId)
        message = clientId 
          ? `Invalidated client access cache for user ${userId} and client ${clientId}`
          : `Invalidated client access cache for user ${userId}`
        break

      case 'subscription':
        if (!orgId) {
          return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
        }
        await UserAccessCacheInvalidator.afterSubscriptionChange(orgId)
        message = `Invalidated subscription cache for organization ${orgId}`
        break

      case 'membership':
        if (!userId || !orgId) {
          return NextResponse.json({ error: 'userId and orgId are required' }, { status: 400 })
        }
        await UserAccessCacheInvalidator.afterRoleChange(userId, orgId)
        message = `Invalidated membership cache for user ${userId} in organization ${orgId}`
        break

      default:
        return NextResponse.json({ error: 'Invalid invalidation type' }, { status: 400 })
    }

    return NextResponse.json({
      message,
      type,
      userId,
      orgId,
      clientId,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error invalidating cache:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}