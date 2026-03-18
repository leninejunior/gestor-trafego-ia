/**
 * Cache Cleanup Service
 * 
 * Background service that periodically cleans up expired cache entries
 * and monitors cache health.
 */

import { userAccessCache } from './user-access-cache'

export class CacheCleanupService {
  private cleanupInterval: NodeJS.Timeout | null = null
  private isRunning = false
  private readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
  private readonly MAX_CACHE_SIZE = 10000 // Maximum number of entries
  private readonly MAX_MEMORY_MB = 100 // Maximum memory usage in MB

  /**
   * Start the cleanup service
   */
  start(): void {
    if (this.isRunning) {
      console.warn('Cache cleanup service is already running')
      return
    }

    console.log('Starting cache cleanup service...')
    this.isRunning = true

    // Run initial cleanup
    this.performCleanup()

    // Schedule periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.performCleanup()
    }, this.CLEANUP_INTERVAL_MS)
  }

  /**
   * Stop the cleanup service
   */
  stop(): void {
    if (!this.isRunning) {
      return
    }

    console.log('Stopping cache cleanup service...')
    this.isRunning = false

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }

  /**
   * Check if the service is running
   */
  isServiceRunning(): boolean {
    return this.isRunning
  }

  /**
   * Perform cleanup operations
   */
  private async performCleanup(): Promise<void> {
    try {
      const startTime = Date.now()
      
      // Get current stats
      const stats = await userAccessCache.getStats()
      
      // Clean up expired entries
      const expiredCount = await userAccessCache.cleanup()
      
      // Check if we need aggressive cleanup
      let aggressiveCleanupCount = 0
      if (stats.totalEntries > this.MAX_CACHE_SIZE || stats.memoryUsageMB > this.MAX_MEMORY_MB) {
        aggressiveCleanupCount = await this.performAggressiveCleanup()
      }

      const duration = Date.now() - startTime
      
      // Log cleanup results
      if (expiredCount > 0 || aggressiveCleanupCount > 0) {
        console.log(`Cache cleanup completed in ${duration}ms:`, {
          expiredRemoved: expiredCount,
          aggressiveRemoved: aggressiveCleanupCount,
          totalEntries: stats.totalEntries,
          memoryUsageMB: stats.memoryUsageMB.toFixed(2),
          hitRate: (stats.hitRate * 100).toFixed(1) + '%'
        })
      }

      // Check cache health and log warnings
      await this.checkCacheHealth()

    } catch (error) {
      console.error('Error during cache cleanup:', error)
    }
  }

  /**
   * Perform aggressive cleanup when cache is too large
   */
  private async performAggressiveCleanup(): Promise<number> {
    console.warn('Performing aggressive cache cleanup due to size/memory limits')
    
    // For now, just clear all cache
    // In a production environment, you might want to implement LRU eviction
    const stats = await userAccessCache.getStats()
    const totalEntries = stats.totalEntries
    
    await userAccessCache.clear()
    
    return totalEntries
  }

  /**
   * Check cache health and log warnings
   */
  private async checkCacheHealth(): Promise<void> {
    try {
      const health = await userAccessCache.getHealthMetrics()
      
      if (!health.isHealthy) {
        console.warn('Cache health issues detected:', {
          issues: health.issues,
          recommendations: health.recommendations
        })
      }

      // Log specific warnings
      if (health.stats.hitRate < 0.5) {
        console.warn(`Low cache hit rate: ${(health.stats.hitRate * 100).toFixed(1)}%`)
      }

      if (health.stats.memoryUsageMB > 50) {
        console.warn(`High cache memory usage: ${health.stats.memoryUsageMB.toFixed(2)}MB`)
      }

      if (health.stats.totalEntries > 5000) {
        console.warn(`High number of cache entries: ${health.stats.totalEntries}`)
      }

    } catch (error) {
      console.error('Error checking cache health:', error)
    }
  }

  /**
   * Get service status
   */
  async getStatus(): Promise<{
    isRunning: boolean
    nextCleanupIn: number | null
    lastCleanupStats: any
  }> {
    const stats = await userAccessCache.getStats()
    
    return {
      isRunning: this.isRunning,
      nextCleanupIn: this.cleanupInterval ? this.CLEANUP_INTERVAL_MS : null,
      lastCleanupStats: {
        totalEntries: stats.totalEntries,
        memoryUsageMB: stats.memoryUsageMB,
        hitRate: stats.hitRate
      }
    }
  }

  /**
   * Force immediate cleanup
   */
  async forceCleanup(): Promise<{
    expiredRemoved: number
    aggressiveRemoved: number
    duration: number
  }> {
    const startTime = Date.now()
    
    const expiredCount = await userAccessCache.cleanup()
    
    const stats = await userAccessCache.getStats()
    let aggressiveCount = 0
    
    if (stats.totalEntries > this.MAX_CACHE_SIZE || stats.memoryUsageMB > this.MAX_MEMORY_MB) {
      aggressiveCount = await this.performAggressiveCleanup()
    }

    const duration = Date.now() - startTime

    return {
      expiredRemoved: expiredCount,
      aggressiveRemoved: aggressiveCount,
      duration
    }
  }
}

// Global cleanup service instance
export const cacheCleanupService = new CacheCleanupService()

// Auto-start the service in production
if (process.env.NODE_ENV === 'production') {
  // Start after a short delay to allow app initialization
  setTimeout(() => {
    cacheCleanupService.start()
  }, 10000) // 10 seconds delay
}

// Graceful shutdown
process.on('SIGTERM', () => {
  cacheCleanupService.stop()
})

process.on('SIGINT', () => {
  cacheCleanupService.stop()
})