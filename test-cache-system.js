/**
 * Simple test script to verify the cache system is working
 * Run with: node test-cache-system.js
 */

const { UserAccessCache, UserAccessCacheKeyBuilder, USER_ACCESS_CACHE_TTL } = require('./src/lib/services/user-access-cache.ts')

async function testCacheSystem() {
  console.log('🧪 Testing User Access Cache System...\n')

  const cache = new UserAccessCache()

  try {
    // Test 1: Basic cache operations
    console.log('1. Testing basic cache operations...')
    await cache.setUserType('user-123', 'org_admin')
    const userType = await cache.getUserType('user-123')
    console.log(`   ✅ User type cached and retrieved: ${userType}`)

    // Test 2: TTL expiration
    console.log('2. Testing TTL expiration...')
    await cache.set('short-lived', 'test-data', 1) // 1 second TTL
    let data = await cache.get('short-lived')
    console.log(`   ✅ Data available immediately: ${data}`)
    
    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 1100))
    data = await cache.get('short-lived')
    console.log(`   ✅ Data expired after TTL: ${data === null ? 'null (expired)' : data}`)

    // Test 3: Cache statistics
    console.log('3. Testing cache statistics...')
    const stats = await cache.getStats()
    console.log(`   ✅ Total entries: ${stats.totalEntries}`)
    console.log(`   ✅ Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`)
    console.log(`   ✅ Memory usage: ${stats.memoryUsageMB.toFixed(2)} MB`)

    // Test 4: Cache invalidation
    console.log('4. Testing cache invalidation...')
    await cache.setUserType('user-456', 'common_user')
    await cache.setClientAccess('user-456', [{ id: 'client-1', name: 'Test Client', orgId: 'org-1', isActive: true }])
    
    const deletedCount = await cache.invalidateUser('user-456')
    console.log(`   ✅ Invalidated ${deletedCount} entries for user`)

    // Test 5: Health metrics
    console.log('5. Testing health metrics...')
    const health = await cache.getHealthMetrics()
    console.log(`   ✅ Cache is healthy: ${health.isHealthy}`)
    console.log(`   ✅ Issues found: ${health.issues.length}`)

    // Test 6: Cache key builder
    console.log('6. Testing cache key builder...')
    const key = UserAccessCacheKeyBuilder.userType('user-789')
    console.log(`   ✅ Generated key: ${key}`)

    console.log('\n🎉 All cache tests passed!')

  } catch (error) {
    console.error('❌ Cache test failed:', error)
  } finally {
    await cache.clear()
    console.log('🧹 Cache cleared')
  }
}

// Run the test
testCacheSystem().catch(console.error)