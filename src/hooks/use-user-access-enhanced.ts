'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { UserType, UserAccessControlService, PlanLimits, Client, LimitedAction } from '@/lib/services/user-access-control'
import { createClient } from '@/lib/supabase/client'
import { 
  AccessControlErrorHandler,
  AccessControlErrorCode,
  usePermissionNotifications,
  usePermissionNotificationHelpers,
  isAccessControlError
} from '@/components/errors'

// Cache configuration
const CACHE_TTL = {
  USER_TYPE: 5 * 60 * 1000, // 5 minutes
  PLAN_LIMITS: 10 * 60 * 1000, // 10 minutes
  CLIENT_ACCESS: 2 * 60 * 1000, // 2 minutes
}

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

// Global cache for user access data
const cache = new Map<string, CacheEntry<any>>()

/**
 * Utility function to get cached data or fetch new data
 */
function getCachedData<T>(
  key: string,
  ttl: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  const cached = cache.get(key)
  const now = Date.now()

  if (cached && (now - cached.timestamp) < cached.ttl) {
    return Promise.resolve(cached.data)
  }

  return fetchFn().then(data => {
    cache.set(key, { data, timestamp: now, ttl })
    return data
  })
}

/**
 * Invalidate cache entries by pattern
 */
function invalidateCache(pattern: string) {
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key)
    }
  }
}

interface UseUserAccessOptions {
  enableNotifications?: boolean
  enableErrorHandling?: boolean
  autoRefresh?: boolean
  refreshInterval?: number
}

interface UseUserAccessReturn {
  // User information
  currentUser: any | null
  userType: UserType | null
  isLoading: boolean
  error: any | null

  // Permission checks
  isSuperAdmin: boolean
  isOrgAdmin: boolean
  isCommonUser: boolean
  
  // Plan limits
  planLimits: PlanLimits | null
  hasActiveSubscription: boolean
  
  // Client access
  accessibleClients: Client[]
  hasClientAccess: (clientId: string) => boolean
  
  // Actions
  checkPermission: (resource: string, action: string, resourceId?: string) => Promise<boolean>
  validatePlanLimit: (action: LimitedAction) => Promise<{ valid: boolean; reason?: string }>
  refresh: () => void
  
  // Error handling
  lastError: any | null
  clearError: () => void
  
  // Utility functions
  canCreateUsers: boolean
  canCreateClients: boolean
  canCreateConnections: boolean
  canManageUsers: boolean
  canAccessClient: (clientId: string) => boolean
}

/**
 * Enhanced hook for user access control with error handling and notifications
 */
export function useUserAccessEnhanced(options: UseUserAccessOptions = {}): UseUserAccessReturn {
  const {
    enableNotifications = true,
    enableErrorHandling = true,
    autoRefresh = false,
    refreshInterval = 5 * 60 * 1000 // 5 minutes
  } = options

  // State
  const [currentUser, setCurrentUser] = useState<any | null>(null)
  const [userType, setUserType] = useState<UserType | null>(null)
  const [planLimits, setPlanLimits] = useState<PlanLimits | null>(null)
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false)
  const [accessibleClients, setAccessibleClients] = useState<Client[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<any | null>(null)
  const [lastError, setLastError] = useState<any | null>(null)

  // Notification hooks (only if enabled)
  const notificationHelpers = enableNotifications ? usePermissionNotificationHelpers() : null

  // Access control service
  const accessControl = useMemo(() => new UserAccessControlService(false), [])

  /**
   * Handle errors with proper error handling and notifications
   */
  const handleError = useCallback((error: any, context?: string) => {
    console.error(`User Access Error (${context}):`, error)
    
    if (enableErrorHandling && isAccessControlError(error)) {
      const accessControlError = AccessControlErrorHandler.handleError(error)
      setLastError(accessControlError)
      
      // Notify user of critical errors
      if (accessControlError.severity === 'high' || accessControlError.severity === 'critical') {
        if (notificationHelpers) {
          // Create appropriate notification based on error type
          switch (accessControlError.code) {
            case AccessControlErrorCode.SUBSCRIPTION_EXPIRED:
              notificationHelpers.notifySubscriptionExpired()
              break
            case AccessControlErrorCode.PLAN_LIMIT_EXCEEDED:
              // Will be handled by specific action attempts
              break
            default:
              // Generic error notification could be added here
              break
          }
        }
      }
    }
    
    setError(error)
  }, [enableErrorHandling, notificationHelpers])

  /**
   * Load user type with caching and error handling
   */
  const loadUserType = useCallback(async () => {
    if (!currentUser?.id) return

    try {
      const cacheKey = `user_type_${currentUser.id}`
      const type = await getCachedData(
        cacheKey,
        CACHE_TTL.USER_TYPE,
        () => accessControl.getUserType(currentUser.id)
      )
      
      // Check if user type changed and notify
      if (userType && userType !== type && notificationHelpers) {
        notificationHelpers.notifyUserTypeChanged(type, userType)
      }
      
      setUserType(type)
    } catch (error) {
      handleError(error, 'loadUserType')
    }
  }, [currentUser?.id, userType, accessControl, handleError, notificationHelpers])

  /**
   * Load plan limits with caching and error handling
   */
  const loadPlanLimits = useCallback(async () => {
    if (!currentUser?.id || userType === UserType.SUPER_ADMIN) {
      setPlanLimits(null)
      setHasActiveSubscription(true)
      return
    }

    try {
      const supabase = createClient()
      const { data: membership } = await supabase
        .from('memberships')
        .select('organization_id')
        .eq('user_id', currentUser.id)
        .single()

      if (!membership?.organization_id) return

      // Get plan limits with cache
      const cacheKey = `plan_limits_${membership.organization_id}`
      
      const [limits, hasActiveSub] = await Promise.all([
        getCachedData(
          cacheKey,
          CACHE_TTL.PLAN_LIMITS,
          () => accessControl.getOrganizationLimits(membership.organization_id)
        ),
        getCachedData(
          `active_subscription_${membership.organization_id}`,
          CACHE_TTL.PLAN_LIMITS,
          () => accessControl.hasActiveSubscription(membership.organization_id)
        )
      ])

      setPlanLimits(limits)
      setHasActiveSubscription(hasActiveSub)

      // Notify if subscription expired
      if (!hasActiveSub && notificationHelpers) {
        notificationHelpers.notifySubscriptionExpired()
      }
    } catch (error) {
      handleError(error, 'loadPlanLimits')
    }
  }, [currentUser?.id, userType, accessControl, handleError, notificationHelpers])

  /**
   * Load accessible clients with caching and error handling
   */
  const loadAccessibleClients = useCallback(async () => {
    if (!currentUser?.id) return

    try {
      const cacheKey = `accessible_clients_${currentUser.id}`
      const clients = await getCachedData(
        cacheKey,
        CACHE_TTL.CLIENT_ACCESS,
        () => accessControl.getUserAccessibleClients(currentUser.id)
      )
      
      // Check for new client access and notify
      if (accessibleClients.length > 0 && clients.length > accessibleClients.length && notificationHelpers) {
        const newClients = clients.filter(c => !accessibleClients.some(ac => ac.id === c.id))
        newClients.forEach(client => {
          notificationHelpers.notifyClientAccessGranted(client.name, client.id)
        })
      }
      
      // Check for revoked client access and notify
      if (accessibleClients.length > 0 && clients.length < accessibleClients.length && notificationHelpers) {
        const revokedClients = accessibleClients.filter(ac => !clients.some(c => c.id === ac.id))
        revokedClients.forEach(client => {
          notificationHelpers.notifyClientAccessRevoked(client.name, client.id)
        })
      }
      
      setAccessibleClients(clients)
    } catch (error) {
      handleError(error, 'loadAccessibleClients')
    }
  }, [currentUser?.id, accessibleClients, accessControl, handleError, notificationHelpers])

  /**
   * Initialize user data
   */
  const initializeUser = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const supabase = createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError) {
        throw authError
      }
      
      setCurrentUser(user)
      
      if (user) {
        await Promise.all([
          loadUserType(),
          loadPlanLimits(),
          loadAccessibleClients()
        ])
      }
    } catch (error) {
      handleError(error, 'initializeUser')
    } finally {
      setIsLoading(false)
    }
  }, [loadUserType, loadPlanLimits, loadAccessibleClients, handleError])

  /**
   * Check permission for a specific resource and action
   */
  const checkPermission = useCallback(async (resource: string, action: string, resourceId?: string) => {
    if (!currentUser?.id) return false

    try {
      const result = await accessControl.checkPermission(
        currentUser.id,
        resource as any,
        action as any,
        resourceId
      )
      return result.allowed
    } catch (error) {
      handleError(error, 'checkPermission')
      return false
    }
  }, [currentUser?.id, accessControl, handleError])

  /**
   * Validate if an action is allowed against plan limits
   */
  const validatePlanLimit = useCallback(async (action: LimitedAction) => {
    if (!currentUser?.id || userType === UserType.SUPER_ADMIN) {
      return { valid: true }
    }

    try {
      const supabase = createClient()
      const { data: membership } = await supabase
        .from('memberships')
        .select('organization_id')
        .eq('user_id', currentUser.id)
        .single()

      if (!membership?.organization_id) {
        return { valid: false, reason: 'Organização não encontrada' }
      }

      const result = await accessControl.validateActionAgainstLimits(
        membership.organization_id,
        action
      )

      return result
    } catch (error) {
      handleError(error, 'validatePlanLimit')
      return { valid: false, reason: 'Erro ao validar limite' }
    }
  }, [currentUser?.id, userType, accessControl, handleError])

  /**
   * Check if user has access to a specific client
   */
  const hasClientAccess = useCallback((clientId: string) => {
    return accessibleClients.some(client => client.id === clientId)
  }, [accessibleClients])

  /**
   * Refresh all user data
   */
  const refresh = useCallback(() => {
    if (currentUser?.id) {
      invalidateCache(`user_type_${currentUser.id}`)
      invalidateCache(`accessible_clients_${currentUser.id}`)
      invalidateCache('plan_limits_')
      invalidateCache('active_subscription_')
      initializeUser()
    }
  }, [currentUser?.id, initializeUser])

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null)
    setLastError(null)
  }, [])

  // Initialize on mount
  useEffect(() => {
    initializeUser()
  }, [initializeUser])

  // Auto refresh if enabled
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(refresh, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, refreshInterval, refresh])

  // Computed values
  const isSuperAdmin = userType === UserType.SUPER_ADMIN
  const isOrgAdmin = userType === UserType.ORG_ADMIN
  const isCommonUser = userType === UserType.COMMON_USER

  const canCreateUsers = isSuperAdmin || isOrgAdmin
  const canCreateClients = isSuperAdmin || isOrgAdmin
  const canCreateConnections = isSuperAdmin || isOrgAdmin
  const canManageUsers = isSuperAdmin || isOrgAdmin

  const canAccessClient = useCallback((clientId: string) => {
    return isSuperAdmin || hasClientAccess(clientId)
  }, [isSuperAdmin, hasClientAccess])

  return {
    // User information
    currentUser,
    userType,
    isLoading,
    error,

    // Permission checks
    isSuperAdmin,
    isOrgAdmin,
    isCommonUser,
    
    // Plan limits
    planLimits,
    hasActiveSubscription,
    
    // Client access
    accessibleClients,
    hasClientAccess,
    
    // Actions
    checkPermission,
    validatePlanLimit,
    refresh,
    
    // Error handling
    lastError,
    clearError,
    
    // Utility functions
    canCreateUsers,
    canCreateClients,
    canCreateConnections,
    canManageUsers,
    canAccessClient
  }
}

/**
 * Simplified hook for basic user access checks
 */
export function useUserAccess() {
  return useUserAccessEnhanced({
    enableNotifications: false,
    enableErrorHandling: true,
    autoRefresh: false
  })
}

/**
 * Hook with full features enabled
 */
export function useUserAccessWithNotifications() {
  return useUserAccessEnhanced({
    enableNotifications: true,
    enableErrorHandling: true,
    autoRefresh: true
  })
}