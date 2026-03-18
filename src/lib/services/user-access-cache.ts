/**
 * User Access Control Cache Service
 * 
 * Implementa sistema de cache para otimização de performance do controle de acesso.
 * Task 17: Implementar sistema de cache para performance
 * 
 * Features:
 * - Cache de tipo de usuário (TTL: 5 minutos)
 * - Cache de limites de plano (TTL: 10 minutos)
 * - Cache de lista de clientes autorizados (TTL: 2 minutos)
 * - Invalidação automática em mudanças de permissão
 * - Estatísticas de cache e monitoramento
 */

import { UserType, PlanLimits, Client } from './user-access-control'

/**
 * Cache TTL configuration (in seconds)
 */
export const USER_ACCESS_CACHE_TTL = {
  userType: 5 * 60,        // 5 minutes
  planLimits: 10 * 60,     // 10 minutes
  clientAccess: 2 * 60,    // 2 minutes
  permissions: 3 * 60,     // 3 minutes
  orgMembership: 5 * 60    // 5 minutes
} as const

/**
 * Cache entry with TTL and metadata
 */
interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
  hits: number
  lastAccessed: number
}

/**
 * Cache statistics
 */
export interface UserAccessCacheStats {
  totalEntries: number
  totalHits: number
  totalMisses: number
  hitRate: number
  memoryUsageMB: number
  entriesByType: Record<string, number>
  oldestEntry?: Date
  newestEntry?: Date
}

/**
 * Cache key builder for user access control
 */
export class UserAccessCacheKeyBuilder {
  static userType(userId: string): string {
    return `user_access:user_type:${userId}`
  }

  static planLimits(orgId: string): string {
    return `user_access:plan_limits:${orgId}`
  }

  static clientAccess(userId: string): string {
    return `user_access:client_access:${userId}`
  }

  static hasClientAccess(userId: string, clientId: string): string {
    return `user_access:has_client_access:${userId}:${clientId}`
  }

  static orgMembership(userId: string, orgId: string): string {
    return `user_access:org_membership:${userId}:${orgId}`
  }

  static permission(userId: string, resource: string, action: string, resourceId?: string): string {
    const resourcePart = resourceId ? `:${resourceId}` : ''
    return `user_access:permission:${userId}:${resource}:${action}${resourcePart}`
  }

  static activeSubscription(orgId: string): string {
    return `user_access:active_subscription:${orgId}`
  }

  static userPattern(userId: string): string {
    return `user_access:*:${userId}*`
  }

  static orgPattern(orgId: string): string {
    return `user_access:*:*:${orgId}*`
  }
}

/**
 * User Access Control Cache Service
 * In-memory cache with TTL, statistics and invalidation
 */
export class UserAccessCacheService {
  private cache: Map<string, CacheEntry<any>> = new Map()
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    invalidations: 0
  }

  /**
   * Get cached data
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key)
    
    if (!entry) {
      this.stats.misses++
      return null
    }

    // Check if expired
    const now = Date.now()
    if (now - entry.timestamp > entry.ttl * 1000) {
      this.cache.delete(key)
      this.stats.misses++
      return null
    }

    // Update access statistics
    entry.hits++
    entry.lastAccessed = now
    this.stats.hits++
    
    return entry.data as T
  }

  /**
   * Set cached data
   */
  async set<T>(key: string, data: T, ttl: number): Promise<void> {
    const now = Date.now()
    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      ttl,
      hits: 0,
      lastAccessed: now
    }

    this.cache.set(key, entry)
    this.stats.sets++
  }

  /**
   * Delete cached data
   */
  async delete(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key)
    if (deleted) {
      this.stats.deletes++
    }
    return deleted
  }

  /**
   * Clear all cache entries matching pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'))
    let deletedCount = 0

    const keysToDelete: string[] = []
    this.cache.forEach((_, key) => {
      if (regex.test(key)) {
        keysToDelete.push(key)
      }
    })

    keysToDelete.forEach(key => {
      this.cache.delete(key)
      deletedCount++
    })

    this.stats.deletes += deletedCount
    return deletedCount
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    this.cache.clear()
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      invalidations: 0
    }
  }

  /**
   * Cleanup expired entries
   */
  async cleanup(): Promise<number> {
    const now = Date.now()
    let cleanedCount = 0

    const keysToDelete: string[] = []
    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > entry.ttl * 1000) {
        keysToDelete.push(key)
      }
    })

    keysToDelete.forEach(key => {
      this.cache.delete(key)
      cleanedCount++
    })

    this.stats.deletes += cleanedCount
    return cleanedCount
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<UserAccessCacheStats> {
    const totalRequests = this.stats.hits + this.stats.misses
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0

    // Calculate memory usage (rough estimate)
    const memoryUsage = this.estimateMemoryUsage()

    // Count entries by type and find oldest/newest
    const entriesByType: Record<string, number> = {}
    let oldestTimestamp = Date.now()
    let newestTimestamp = 0

    this.cache.forEach((entry, key) => {
      const type = key.split(':')[1] || 'unknown'
      entriesByType[type] = (entriesByType[type] || 0) + 1
      
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp
      }
      if (entry.timestamp > newestTimestamp) {
        newestTimestamp = entry.timestamp
      }
    })

    return {
      totalEntries: this.cache.size,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      hitRate: Number(hitRate.toFixed(3)),
      memoryUsageMB: Number(memoryUsage.toFixed(2)),
      entriesByType,
      oldestEntry: this.cache.size > 0 ? new Date(oldestTimestamp) : undefined,
      newestEntry: this.cache.size > 0 ? new Date(newestTimestamp) : undefined
    }
  }

  /**
   * Estimate memory usage in MB
   */
  private estimateMemoryUsage(): number {
    let totalSize = 0

    this.cache.forEach((entry, key) => {
      // Rough estimation: key size + JSON size of data + metadata
      totalSize += key.length * 2 // UTF-16 characters
      totalSize += JSON.stringify(entry.data).length * 2
      totalSize += 128 // Overhead for entry metadata
    })

    return totalSize / (1024 * 1024) // Convert to MB
  }

  /**
   * Get detailed entry information
   */
  async getEntryInfo(key: string): Promise<{
    exists: boolean
    sizeBytes?: number
    ttlRemainingSeconds?: number
    hits?: number
    createdAt?: Date
    lastAccessed?: Date
  }> {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return { exists: false }
    }

    const now = Date.now()
    const ageMs = now - entry.timestamp
    const ttlRemainingMs = (entry.ttl * 1000) - ageMs

    return {
      exists: true,
      sizeBytes: JSON.stringify(entry.data).length * 2,
      ttlRemainingSeconds: Math.max(0, Math.floor(ttlRemainingMs / 1000)),
      hits: entry.hits,
      createdAt: new Date(entry.timestamp),
      lastAccessed: new Date(entry.lastAccessed)
    }
  }
}

/**
 * Specialized cache methods for User Access Control
 */
export class UserAccessCache extends UserAccessCacheService {
  
  /**
   * Cache user type
   */
  async setUserType(userId: string, userType: UserType): Promise<void> {
    const key = UserAccessCacheKeyBuilder.userType(userId)
    await this.set(key, userType, USER_ACCESS_CACHE_TTL.userType)
  }

  /**
   * Get cached user type
   */
  async getUserType(userId: string): Promise<UserType | null> {
    const key = UserAccessCacheKeyBuilder.userType(userId)
    return await this.get<UserType>(key)
  }

  /**
   * Cache plan limits
   */
  async setPlanLimits(orgId: string, limits: PlanLimits): Promise<void> {
    const key = UserAccessCacheKeyBuilder.planLimits(orgId)
    await this.set(key, limits, USER_ACCESS_CACHE_TTL.planLimits)
  }

  /**
   * Get cached plan limits
   */
  async getPlanLimits(orgId: string): Promise<PlanLimits | null> {
    const key = UserAccessCacheKeyBuilder.planLimits(orgId)
    return await this.get<PlanLimits>(key)
  }

  /**
   * Cache client access list
   */
  async setClientAccess(userId: string, clients: Client[]): Promise<void> {
    const key = UserAccessCacheKeyBuilder.clientAccess(userId)
    await this.set(key, clients, USER_ACCESS_CACHE_TTL.clientAccess)
  }

  /**
   * Get cached client access list
   */
  async getClientAccess(userId: string): Promise<Client[] | null> {
    const key = UserAccessCacheKeyBuilder.clientAccess(userId)
    return await this.get<Client[]>(key)
  }

  /**
   * Cache specific client access permission
   */
  async setHasClientAccess(userId: string, clientId: string, hasAccess: boolean): Promise<void> {
    const key = UserAccessCacheKeyBuilder.hasClientAccess(userId, clientId)
    await this.set(key, hasAccess, USER_ACCESS_CACHE_TTL.clientAccess)
  }

  /**
   * Get cached specific client access permission
   */
  async getHasClientAccess(userId: string, clientId: string): Promise<boolean | null> {
    const key = UserAccessCacheKeyBuilder.hasClientAccess(userId, clientId)
    return await this.get<boolean>(key)
  }

  /**
   * Cache organization membership
   */
  async setOrgMembership(userId: string, orgId: string, isAdmin: boolean): Promise<void> {
    const key = UserAccessCacheKeyBuilder.orgMembership(userId, orgId)
    await this.set(key, isAdmin, USER_ACCESS_CACHE_TTL.orgMembership)
  }

  /**
   * Get cached organization membership
   */
  async getOrgMembership(userId: string, orgId: string): Promise<boolean | null> {
    const key = UserAccessCacheKeyBuilder.orgMembership(userId, orgId)
    return await this.get<boolean>(key)
  }

  /**
   * Cache permission result
   */
  async setPermission(
    userId: string, 
    resource: string, 
    action: string, 
    resourceId: string | undefined, 
    result: any
  ): Promise<void> {
    const key = UserAccessCacheKeyBuilder.permission(userId, resource, action, resourceId)
    await this.set(key, result, USER_ACCESS_CACHE_TTL.permissions)
  }

  /**
   * Get cached permission result
   */
  async getPermission(
    userId: string, 
    resource: string, 
    action: string, 
    resourceId?: string
  ): Promise<any | null> {
    const key = UserAccessCacheKeyBuilder.permission(userId, resource, action, resourceId)
    return await this.get(key)
  }

  /**
   * Cache active subscription status
   */
  async setActiveSubscription(orgId: string, isActive: boolean): Promise<void> {
    const key = UserAccessCacheKeyBuilder.activeSubscription(orgId)
    await this.set(key, isActive, USER_ACCESS_CACHE_TTL.planLimits)
  }

  /**
   * Get cached active subscription status
   */
  async getActiveSubscription(orgId: string): Promise<boolean | null> {
    const key = UserAccessCacheKeyBuilder.activeSubscription(orgId)
    return await this.get<boolean>(key)
  }

  /**
   * Invalidate all cache for a specific user
   * Called when user permissions change
   */
  async invalidateUser(userId: string): Promise<number> {
    const pattern = UserAccessCacheKeyBuilder.userPattern(userId)
    const deletedCount = await this.deletePattern(pattern)
    // Access parent's protected stats property
    ;(this as any).stats.invalidations++
    return deletedCount
  }

  /**
   * Invalidate all cache for a specific organization
   * Called when organization settings change
   */
  async invalidateOrganization(orgId: string): Promise<number> {
    const pattern = UserAccessCacheKeyBuilder.orgPattern(orgId)
    const deletedCount = await this.deletePattern(pattern)
    // Access parent's protected stats property
    ;(this as any).stats.invalidations++
    return deletedCount
  }

  /**
   * Invalidate cache after user type change
   */
  async invalidateAfterUserTypeChange(userId: string): Promise<void> {
    // Invalidate all user-related cache
    await this.invalidateUser(userId)
  }

  /**
   * Invalidate cache after client access change
   */
  async invalidateAfterClientAccessChange(userId: string, clientId?: string): Promise<void> {
    // Invalidate user's client access cache
    await this.delete(UserAccessCacheKeyBuilder.clientAccess(userId))
    
    // If specific client, invalidate that specific permission
    if (clientId) {
      await this.delete(UserAccessCacheKeyBuilder.hasClientAccess(userId, clientId))
    }
    
    // Invalidate permission cache for this user
    await this.deletePattern(`user_access:permission:${userId}:*`)
  }

  /**
   * Invalidate cache after organization membership change
   */
  async invalidateAfterMembershipChange(userId: string, orgId: string): Promise<void> {
    // Invalidate user type (might have changed from/to org admin)
    await this.delete(UserAccessCacheKeyBuilder.userType(userId))
    
    // Invalidate org membership
    await this.delete(UserAccessCacheKeyBuilder.orgMembership(userId, orgId))
    
    // Invalidate client access (org change affects accessible clients)
    await this.delete(UserAccessCacheKeyBuilder.clientAccess(userId))
    
    // Invalidate permissions
    await this.deletePattern(`user_access:permission:${userId}:*`)
  }

  /**
   * Invalidate cache after plan limits change
   */
  async invalidateAfterPlanChange(orgId: string): Promise<void> {
    // Invalidate plan limits
    await this.delete(UserAccessCacheKeyBuilder.planLimits(orgId))
    
    // Invalidate active subscription status
    await this.delete(UserAccessCacheKeyBuilder.activeSubscription(orgId))
    
    // Invalidate all permissions that might be affected by plan limits
    await this.deletePattern(`user_access:permission:*`)
  }

  /**
   * Warm up cache with commonly accessed data
   */
  async warmUp(userId: string, userType: UserType, clients: Client[]): Promise<void> {
    // Cache user type
    await this.setUserType(userId, userType)
    
    // Cache client access
    await this.setClientAccess(userId, clients)
    
    // Cache individual client access permissions
    for (const client of clients) {
      await this.setHasClientAccess(userId, client.id, true)
    }
  }

  /**
   * Batch invalidation for multiple users
   */
  async batchInvalidateUsers(userIds: string[]): Promise<number> {
    let totalDeleted = 0
    
    for (const userId of userIds) {
      totalDeleted += await this.invalidateUser(userId)
    }
    
    return totalDeleted
  }

  /**
   * Get cache health metrics
   */
  async getHealthMetrics(): Promise<{
    isHealthy: boolean
    issues: string[]
    recommendations: string[]
    stats: UserAccessCacheStats
  }> {
    const stats = await this.getStats()
    const issues: string[] = []
    const recommendations: string[] = []

    // Check hit rate
    if (stats.hitRate < 0.7) {
      issues.push(`Low cache hit rate: ${(stats.hitRate * 100).toFixed(1)}%`)
      recommendations.push('Consider increasing TTL values or reviewing cache invalidation strategy')
    }

    // Check memory usage
    if (stats.memoryUsageMB > 100) {
      issues.push(`High memory usage: ${stats.memoryUsageMB.toFixed(2)}MB`)
      recommendations.push('Consider implementing cache size limits or more aggressive cleanup')
    }

    // Check entry distribution
    const totalEntries = stats.totalEntries
    if (totalEntries > 10000) {
      issues.push(`High number of cache entries: ${totalEntries}`)
      recommendations.push('Consider implementing LRU eviction or reducing TTL values')
    }

    const isHealthy = issues.length === 0

    return {
      isHealthy,
      issues,
      recommendations,
      stats
    }
  }
}

// Global cache instance
export const userAccessCache = new UserAccessCache()

/**
 * Cache middleware decorator for methods
 */
export function CachedUserAccess(
  ttl: number, 
  keyBuilder: (...args: any[]) => string
) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const cacheKey = keyBuilder(...args)

      // Try cache first
      const cached = await userAccessCache.get(cacheKey)
      if (cached !== null) {
        return cached
      }

      // Execute method and cache result
      const result = await method.apply(this, args)
      await userAccessCache.set(cacheKey, result, ttl)
      
      return result
    }
  }
}

/**
 * Cache invalidation helper for API endpoints
 */
export class UserAccessCacheInvalidator {
  /**
   * Invalidate after user creation
   */
  static async afterUserCreation(userId: string, orgId: string): Promise<void> {
    // Invalidate organization-wide caches that might be affected
    await userAccessCache.invalidateAfterPlanChange(orgId)
  }

  /**
   * Invalidate after user deletion
   */
  static async afterUserDeletion(userId: string, orgId: string): Promise<void> {
    // Invalidate all user cache
    await userAccessCache.invalidateUser(userId)
    
    // Invalidate organization limits (user count changed)
    await userAccessCache.invalidateAfterPlanChange(orgId)
  }

  /**
   * Invalidate after client access grant/revoke
   */
  static async afterClientAccessChange(userId: string, clientId: string): Promise<void> {
    await userAccessCache.invalidateAfterClientAccessChange(userId, clientId)
  }

  /**
   * Invalidate after user role change
   */
  static async afterRoleChange(userId: string, orgId: string): Promise<void> {
    await userAccessCache.invalidateAfterMembershipChange(userId, orgId)
  }

  /**
   * Invalidate after subscription change
   */
  static async afterSubscriptionChange(orgId: string): Promise<void> {
    await userAccessCache.invalidateAfterPlanChange(orgId)
  }
}