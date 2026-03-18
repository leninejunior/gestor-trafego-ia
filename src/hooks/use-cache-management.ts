/**
 * Cache Management Hook
 * 
 * Provides functionality for managing the user access control cache
 * from the admin interface.
 */

import { useState, useCallback } from 'react'
import { UserAccessCacheStats } from '@/lib/services/user-access-cache'

interface CacheHealthMetrics {
  isHealthy: boolean
  issues: string[]
  recommendations: string[]
  stats: UserAccessCacheStats
}

interface CacheManagementState {
  stats: UserAccessCacheStats | null
  health: CacheHealthMetrics | null
  loading: boolean
  error: string | null
}

export function useCacheManagement() {
  const [state, setState] = useState<CacheManagementState>({
    stats: null,
    health: null,
    loading: false,
    error: null
  })

  /**
   * Get cache statistics and health metrics
   */
  const getCacheStats = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const response = await fetch('/api/admin/cache')
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      setState(prev => ({
        ...prev,
        stats: data.stats,
        health: data.health,
        loading: false
      }))

      return data
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }))
      throw error
    }
  }, [])

  /**
   * Clear all cache
   */
  const clearCache = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const response = await fetch('/api/admin/cache', {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      // Refresh stats after clearing
      await getCacheStats()

      return data
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }))
      throw error
    }
  }, [getCacheStats])

  /**
   * Cleanup expired cache entries
   */
  const cleanupCache = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const response = await fetch('/api/admin/cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'cleanup' })
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      // Refresh stats after cleanup
      await getCacheStats()

      return data
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }))
      throw error
    }
  }, [getCacheStats])

  /**
   * Invalidate cache for specific user
   */
  const invalidateUser = useCallback(async (userId: string) => {
    try {
      const response = await fetch('/api/admin/cache/invalidate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type: 'user', userId })
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      // Refresh stats after invalidation
      await getCacheStats()

      return data
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setState(prev => ({
        ...prev,
        error: errorMessage
      }))
      throw error
    }
  }, [getCacheStats])

  /**
   * Invalidate cache for specific organization
   */
  const invalidateOrganization = useCallback(async (orgId: string) => {
    try {
      const response = await fetch('/api/admin/cache/invalidate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type: 'organization', orgId })
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      // Refresh stats after invalidation
      await getCacheStats()

      return data
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setState(prev => ({
        ...prev,
        error: errorMessage
      }))
      throw error
    }
  }, [getCacheStats])

  /**
   * Invalidate client access cache
   */
  const invalidateClientAccess = useCallback(async (userId: string, clientId?: string) => {
    try {
      const response = await fetch('/api/admin/cache/invalidate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type: 'client_access', userId, clientId })
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      // Refresh stats after invalidation
      await getCacheStats()

      return data
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setState(prev => ({
        ...prev,
        error: errorMessage
      }))
      throw error
    }
  }, [getCacheStats])

  /**
   * Invalidate subscription cache
   */
  const invalidateSubscription = useCallback(async (orgId: string) => {
    try {
      const response = await fetch('/api/admin/cache/invalidate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type: 'subscription', orgId })
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      // Refresh stats after invalidation
      await getCacheStats()

      return data
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setState(prev => ({
        ...prev,
        error: errorMessage
      }))
      throw error
    }
  }, [getCacheStats])

  /**
   * Invalidate membership cache
   */
  const invalidateMembership = useCallback(async (userId: string, orgId: string) => {
    try {
      const response = await fetch('/api/admin/cache/invalidate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type: 'membership', userId, orgId })
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      // Refresh stats after invalidation
      await getCacheStats()

      return data
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setState(prev => ({
        ...prev,
        error: errorMessage
      }))
      throw error
    }
  }, [getCacheStats])

  return {
    // State
    stats: state.stats,
    health: state.health,
    loading: state.loading,
    error: state.error,

    // Actions
    getCacheStats,
    clearCache,
    cleanupCache,
    invalidateUser,
    invalidateOrganization,
    invalidateClientAccess,
    invalidateSubscription,
    invalidateMembership
  }
}