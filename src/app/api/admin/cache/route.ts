import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { userAccessCache } from '@/lib/services/user-access-cache'
import { isSuperAdmin } from '@/lib/auth/super-admin'

/**
 * Cache Management API
 * 
 * GET /api/admin/cache - Get cache statistics and health
 * DELETE /api/admin/cache - Clear all cache (Super Admin only)
 * POST /api/admin/cache/cleanup - Cleanup expired entries (Super Admin only)
 */

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is super admin
    const isSuper = await isSuperAdmin(user.id)
    if (!isSuper) {
      return NextResponse.json({ error: 'Forbidden: Super admin access required' }, { status: 403 })
    }

    // Get cache statistics and health metrics
    const [stats, health] = await Promise.all([
      userAccessCache.getStats(),
      userAccessCache.getHealthMetrics()
    ])

    return NextResponse.json({
      stats,
      health,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error getting cache stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is super admin
    const isSuper = await isSuperAdmin(user.id)
    if (!isSuper) {
      return NextResponse.json({ error: 'Forbidden: Super admin access required' }, { status: 403 })
    }

    // Clear all cache
    await userAccessCache.clear()

    return NextResponse.json({
      message: 'Cache cleared successfully',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error clearing cache:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is super admin
    const isSuper = await isSuperAdmin(user.id)
    if (!isSuper) {
      return NextResponse.json({ error: 'Forbidden: Super admin access required' }, { status: 403 })
    }

    const { action } = await request.json()

    if (action === 'cleanup') {
      // Cleanup expired entries
      const cleanedCount = await userAccessCache.cleanup()

      return NextResponse.json({
        message: `Cleaned up ${cleanedCount} expired entries`,
        cleanedCount,
        timestamp: new Date().toISOString()
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Error in cache management:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}