/**
 * User Access Cache Service Tests
 * 
 * Tests the cache functionality for user access control
 */

import { UserAccessCache, UserAccessCacheKeyBuilder, USER_ACCESS_CACHE_TTL } from '../../user-access-cache'
import { UserType } from '../../user-access-control'

describe('UserAccessCache', () => {
  let cache: UserAccessCache

  beforeEach(() => {
    cache = new UserAccessCache()
  })

  afterEach(async () => {
    await cache.clear()
  })

  describe('Basic Cache Operations', () => {
    it('should store and retrieve user type', async () => {
      const userId = 'user-123'
      const userType = UserType.ORG_ADMIN

      await cache.setUserType(userId, userType)
      const retrieved = await cache.getUserType(userId)

      expect(retrieved).toBe(userType)
    })

    it('should return null for non-existent keys', async () => {
      const result = await cache.getUserType('non-existent')
      expect(result).toBeNull()
    })

    it('should handle TTL expiration', async () => {
      const userId = 'user-123'
      const userType = UserType.COMMON_USER

      // Set with very short TTL (1 second)
      await cache.set('test-key', userType, 1)
      
      // Should be available immediately
      let result = await cache.get('test-key')
      expect(result).toBe(userType)

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100))

      // Should be expired now
      result = await cache.get('test-key')
      expect(result).toBeNull()
    })
  })

  describe('Plan Limits Cache', () => {
    it('should cache and retrieve plan limits', async () => {
      const orgId = 'org-123'
      const limits = {
        maxUsers: 10,
        maxClients: 5,
        maxConnections: 3,
        maxCampaigns: 20,
        currentUsage: {
          users: 2,
          clients: 1,
          connections: 1,
          campaigns: 5
        }
      }

      await cache.setPlanLimits(orgId, limits)
      const retrieved = await cache.getPlanLimits(orgId)

      expect(retrieved).toEqual(limits)
    })
  })

  describe('Client Access Cache', () => {
    it('should cache client access list', async () => {
      const userId = 'user-123'
      const clients = [
        { id: 'client-1', name: 'Client 1', orgId: 'org-1', isActive: true },
        { id: 'client-2', name: 'Client 2', orgId: 'org-1', isActive: true }
      ]

      await cache.setClientAccess(userId, clients)
      const retrieved = await cache.getClientAccess(userId)

      expect(retrieved).toEqual(clients)
    })

    it('should cache specific client access permissions', async () => {
      const userId = 'user-123'
      const clientId = 'client-456'

      await cache.setHasClientAccess(userId, clientId, true)
      const hasAccess = await cache.getHasClientAccess(userId, clientId)

      expect(hasAccess).toBe(true)
    })
  })

  describe('Cache Invalidation', () => {
    it('should invalidate user cache', async () => {
      const userId = 'user-123'
      
      // Set some user-related cache entries
      await cache.setUserType(userId, UserType.ORG_ADMIN)
      await cache.setClientAccess(userId, [])
      await cache.setHasClientAccess(userId, 'client-1', true)

      // Verify they exist
      expect(await cache.getUserType(userId)).toBe(UserType.ORG_ADMIN)
      expect(await cache.getClientAccess(userId)).toEqual([])
      expect(await cache.getHasClientAccess(userId, 'client-1')).toBe(true)

      // Invalidate user cache
      const deletedCount = await cache.invalidateUser(userId)
      expect(deletedCount).toBeGreaterThan(0)

      // Verify they're gone
      expect(await cache.getUserType(userId)).toBeNull()
      expect(await cache.getClientAccess(userId)).toBeNull()
      expect(await cache.getHasClientAccess(userId, 'client-1')).toBeNull()
    })

    it('should invalidate organization cache', async () => {
      const orgId = 'org-123'
      const limits = {
        maxUsers: 10,
        maxClients: 5,
        maxConnections: 3,
        maxCampaigns: 20,
        currentUsage: { users: 2, clients: 1, connections: 1, campaigns: 5 }
      }

      await cache.setPlanLimits(orgId, limits)
      await cache.setActiveSubscription(orgId, true)

      // Verify they exist
      expect(await cache.getPlanLimits(orgId)).toEqual(limits)
      expect(await cache.getActiveSubscription(orgId)).toBe(true)

      // Invalidate organization cache
      const deletedCount = await cache.invalidateOrganization(orgId)
      expect(deletedCount).toBeGreaterThan(0)

      // Verify they're gone
      expect(await cache.getPlanLimits(orgId)).toBeNull()
      expect(await cache.getActiveSubscription(orgId)).toBeNull()
    })
  })

  describe('Cache Statistics', () => {
    it('should track cache statistics', async () => {
      // Add some entries
      await cache.setUserType('user-1', UserType.SUPER_ADMIN)
      await cache.setUserType('user-2', UserType.ORG_ADMIN)
      await cache.setPlanLimits('org-1', {
        maxUsers: 10, maxClients: 5, maxConnections: 3, maxCampaigns: 20,
        currentUsage: { users: 2, clients: 1, connections: 1, campaigns: 5 }
      })

      // Generate some hits and misses
      await cache.getUserType('user-1') // hit
      await cache.getUserType('user-1') // hit
      await cache.getUserType('non-existent') // miss

      const stats = await cache.getStats()

      expect(stats.totalEntries).toBe(3)
      expect(stats.totalHits).toBe(2)
      expect(stats.totalMisses).toBe(1)
      expect(stats.hitRate).toBeCloseTo(0.667, 2)
      expect(stats.entriesByType).toHaveProperty('user_type')
      expect(stats.entriesByType).toHaveProperty('plan_limits')
    })

    it('should provide health metrics', async () => {
      const health = await cache.getHealthMetrics()

      expect(health).toHaveProperty('isHealthy')
      expect(health).toHaveProperty('issues')
      expect(health).toHaveProperty('recommendations')
      expect(health).toHaveProperty('stats')
      expect(Array.isArray(health.issues)).toBe(true)
      expect(Array.isArray(health.recommendations)).toBe(true)
    })
  })

  describe('Cache Key Builder', () => {
    it('should generate consistent cache keys', () => {
      const userId = 'user-123'
      const orgId = 'org-456'
      const clientId = 'client-789'

      expect(UserAccessCacheKeyBuilder.userType(userId))
        .toBe('user_access:user_type:user-123')
      
      expect(UserAccessCacheKeyBuilder.planLimits(orgId))
        .toBe('user_access:plan_limits:org-456')
      
      expect(UserAccessCacheKeyBuilder.hasClientAccess(userId, clientId))
        .toBe('user_access:has_client_access:user-123:client-789')
      
      expect(UserAccessCacheKeyBuilder.userPattern(userId))
        .toBe('user_access:*:user-123*')
    })
  })

  describe('Cache Cleanup', () => {
    it('should cleanup expired entries', async () => {
      // Add entries with different TTLs
      await cache.set('short-lived', 'data1', 1) // 1 second
      await cache.set('long-lived', 'data2', 60) // 60 seconds

      // Wait for short-lived to expire
      await new Promise(resolve => setTimeout(resolve, 1100))

      const cleanedCount = await cache.cleanup()
      expect(cleanedCount).toBe(1)

      // Verify short-lived is gone, long-lived remains
      expect(await cache.get('short-lived')).toBeNull()
      expect(await cache.get('long-lived')).toBe('data2')
    })
  })

  describe('Cache Warm-up', () => {
    it('should warm up cache with user data', async () => {
      const userId = 'user-123'
      const userType = UserType.ORG_ADMIN
      const clients = [
        { id: 'client-1', name: 'Client 1', orgId: 'org-1', isActive: true }
      ]

      await cache.warmUp(userId, userType, clients)

      // Verify all data is cached
      expect(await cache.getUserType(userId)).toBe(userType)
      expect(await cache.getClientAccess(userId)).toEqual(clients)
      expect(await cache.getHasClientAccess(userId, 'client-1')).toBe(true)
    })
  })
})