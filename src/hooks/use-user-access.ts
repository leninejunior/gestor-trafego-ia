'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { UserType, UserAccessControlService, PlanLimits, Client } from '@/lib/services/user-access-control'
import { createClient } from '@/lib/supabase/client'

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

/**
 * Hook principal para controle de acesso do usuário
 * Centraliza toda a lógica de acesso e fornece cache automático
 * Requirements: 1.1, 5.1, 4.5
 */
export function useUserAccess() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = useMemo(() => createClient(), [])
  const accessControl = useMemo(() => new UserAccessControlService(false), [])

  // Load current user
  useEffect(() => {
    const loadUser = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        
        if (authError) {
          setError('Erro de autenticação')
          setCurrentUser(null)
        } else {
          setCurrentUser(user)
          setError(null)
        }
      } catch (err) {
        console.error('Erro ao carregar usuário:', err)
        setError('Erro ao carregar usuário')
        setCurrentUser(null)
      } finally {
        setLoading(false)
      }
    }

    loadUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        loadUser()
        // Clear cache on auth changes
        cache.clear()
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const refresh = useCallback(() => {
    if (currentUser) {
      // Invalidate all cache for current user
      invalidateCache(currentUser.id)
    }
  }, [currentUser])

  const checkPermission = useCallback(async (
    resourceType: string,
    action: string,
    resourceId?: string
  ): Promise<boolean> => {
    if (!currentUser) return false

    try {
      const result = await accessControl.checkPermission(
        currentUser.id,
        resourceType as any,
        action as any,
        resourceId
      )
      return result.allowed
    } catch (err) {
      console.error('Erro ao verificar permissão:', err)
      return false
    }
  }, [currentUser, accessControl])

  const hasClientAccess = useCallback(async (clientId: string): Promise<boolean> => {
    if (!currentUser) return false

    const cacheKey = `client_access_${currentUser.id}_${clientId}`
    
    return getCachedData(
      cacheKey,
      CACHE_TTL.CLIENT_ACCESS,
      () => accessControl.hasClientAccess(currentUser.id, clientId)
    )
  }, [currentUser, accessControl])

  const getUserAccessibleClients = useCallback(async (): Promise<Client[]> => {
    if (!currentUser) return []

    const cacheKey = `accessible_clients_${currentUser.id}`
    
    return getCachedData(
      cacheKey,
      CACHE_TTL.CLIENT_ACCESS,
      async () => {
        try {
          const response = await fetch('/api/user/accessible-clients')
          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Erro ao buscar clientes acessíveis')
          }
          const data = await response.json()
          return data.clients || []
        } catch (error) {
          console.error('Erro ao buscar clientes acessíveis via API:', error)
          return []
        }
      }
    )
  }, [currentUser])

  return {
    currentUser,
    loading,
    error,
    refresh,
    checkPermission,
    hasClientAccess,
    getUserAccessibleClients
  }
}

/**
 * Hook para obter e gerenciar o tipo de usuário
 * Requirements: 1.1
 */
export function useUserType() {
  const { currentUser, loading: userLoading } = useUserAccess()
  const [userType, setUserType] = useState<UserType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const accessControl = useMemo(() => new UserAccessControlService(false), [])

  const loadUserType = useCallback(async () => {
    if (!currentUser) {
      setUserType(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const cacheKey = `user_type_${currentUser.id}`
      
      const type = await getCachedData(
        cacheKey,
        CACHE_TTL.USER_TYPE,
        () => accessControl.getUserType(currentUser.id)
      )

      setUserType(type)
    } catch (err) {
      console.error('Erro ao obter tipo de usuário:', err)
      setError('Erro ao obter tipo de usuário')
      setUserType(null)
    } finally {
      setLoading(false)
    }
  }, [currentUser, accessControl])

  useEffect(() => {
    if (!userLoading) {
      loadUserType()
    }
  }, [userLoading, loadUserType])

  const refresh = useCallback(() => {
    if (currentUser) {
      invalidateCache(`user_type_${currentUser.id}`)
      loadUserType()
    }
  }, [currentUser, loadUserType])

  return {
    userType,
    loading: userLoading || loading,
    error,
    refresh,
    isSuperAdmin: userType === UserType.SUPER_ADMIN,
    isOrgAdmin: userType === UserType.ORG_ADMIN,
    isCommonUser: userType === UserType.COMMON_USER
  }
}

/**
 * Hook para verificar acesso a clientes específicos
 * Requirements: 5.1
 */
export function useClientAccess() {
  const { currentUser, hasClientAccess, getUserAccessibleClients } = useUserAccess()
  const [accessibleClients, setAccessibleClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadAccessibleClients = useCallback(async () => {
    if (!currentUser) {
      setAccessibleClients([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const clients = await getUserAccessibleClients()
      setAccessibleClients(clients)
    } catch (err) {
      console.error('Erro ao obter clientes acessíveis:', err)
      setError('Erro ao obter clientes acessíveis')
      setAccessibleClients([])
    } finally {
      setLoading(false)
    }
  }, [currentUser, getUserAccessibleClients])

  useEffect(() => {
    loadAccessibleClients()
  }, [loadAccessibleClients])

  const checkClientAccess = useCallback(async (clientId: string): Promise<boolean> => {
    return hasClientAccess(clientId)
  }, [hasClientAccess])

  const refresh = useCallback(() => {
    if (currentUser) {
      invalidateCache(`accessible_clients_${currentUser.id}`)
      invalidateCache(`client_access_${currentUser.id}`)
      loadAccessibleClients()
    }
  }, [currentUser, loadAccessibleClients])

  return {
    accessibleClients,
    loading,
    error,
    refresh,
    checkClientAccess,
    hasAccessToClient: checkClientAccess
  }
}

/**
 * Hook para obter limites e uso do plano
 * Requirements: 4.5
 */
export function usePlanLimits() {
  const { currentUser } = useUserAccess()
  const { userType } = useUserType()
  const [planLimits, setPlanLimits] = useState<PlanLimits | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = useMemo(() => createClient(), [])
  const accessControl = useMemo(() => new UserAccessControlService(false), [])

  const loadPlanLimits = useCallback(async () => {
    if (!currentUser || !userType) {
      setPlanLimits(null)
      setOrganizationId(null)
      setHasActiveSubscription(false)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Super admins don't have limits
      if (userType === UserType.SUPER_ADMIN) {
        setPlanLimits({
          maxUsers: null,
          maxClients: null,
          maxConnections: null,
          maxCampaigns: null,
          currentUsage: {
            users: 0,
            clients: 0,
            connections: 0,
            campaigns: 0
          }
        })
        setHasActiveSubscription(true)
        setLoading(false)
        return
      }

      // Get user's organization
      const { data: membership } = await supabase
        .from('memberships')
        .select('organization_id')
        .eq('user_id', currentUser.id)
        .single()

      if (!membership) {
        throw new Error('Usuário não pertence a nenhuma organização')
      }

      setOrganizationId(membership.organization_id)

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
    } catch (err) {
      console.error('Erro ao obter limites do plano:', err)
      setError('Erro ao obter limites do plano')
      setPlanLimits(null)
      setHasActiveSubscription(false)
    } finally {
      setLoading(false)
    }
  }, [currentUser, userType, supabase, accessControl])

  useEffect(() => {
    loadPlanLimits()
  }, [loadPlanLimits])

  const refresh = useCallback(() => {
    if (organizationId) {
      invalidateCache(`plan_limits_${organizationId}`)
      invalidateCache(`active_subscription_${organizationId}`)
      loadPlanLimits()
    }
  }, [organizationId, loadPlanLimits])

  const canCreateUsers = useMemo(() => {
    if (userType === UserType.SUPER_ADMIN) return true
    if (userType !== UserType.ORG_ADMIN || !hasActiveSubscription) return false
    if (!planLimits) return false
    
    return planLimits.maxUsers === null || 
           planLimits.currentUsage.users < planLimits.maxUsers
  }, [userType, hasActiveSubscription, planLimits])

  const canCreateClients = useMemo(() => {
    if (userType === UserType.SUPER_ADMIN) return true
    if (userType !== UserType.ORG_ADMIN || !hasActiveSubscription) return false
    if (!planLimits) return false
    
    return planLimits.maxClients === null || 
           planLimits.currentUsage.clients < planLimits.maxClients
  }, [userType, hasActiveSubscription, planLimits])

  const canCreateConnections = useMemo(() => {
    if (userType === UserType.SUPER_ADMIN) return true
    if (userType !== UserType.ORG_ADMIN || !hasActiveSubscription) return false
    if (!planLimits) return false
    
    return planLimits.maxConnections === null || 
           planLimits.currentUsage.connections < planLimits.maxConnections
  }, [userType, hasActiveSubscription, planLimits])

  const canCreateCampaigns = useMemo(() => {
    if (userType === UserType.SUPER_ADMIN) return true
    if (!hasActiveSubscription) return false
    if (!planLimits) return false
    
    return planLimits.maxCampaigns === null || 
           planLimits.currentUsage.campaigns < planLimits.maxCampaigns
  }, [userType, hasActiveSubscription, planLimits])

  return {
    planLimits,
    organizationId,
    hasActiveSubscription,
    loading,
    error,
    refresh,
    canCreateUsers,
    canCreateClients,
    canCreateConnections,
    canCreateCampaigns
  }
}

/**
 * Convenience hooks for specific user types
 */
export function useIsSuperAdmin(): boolean {
  const { userType } = useUserType()
  return userType === UserType.SUPER_ADMIN
}

export function useIsOrgAdmin(): boolean {
  const { userType } = useUserType()
  return userType === UserType.ORG_ADMIN
}

export function useIsCommonUser(): boolean {
  const { userType } = useUserType()
  return userType === UserType.COMMON_USER
}

/**
 * Hook for invalidating all access control caches
 * Useful when permissions change
 */
export function useAccessControlCache() {
  const { currentUser } = useUserAccess()

  const invalidateAll = useCallback(() => {
    cache.clear()
  }, [])

  const invalidateUser = useCallback(() => {
    if (currentUser) {
      invalidateCache(currentUser.id)
    }
  }, [currentUser])

  const invalidateUserType = useCallback(() => {
    if (currentUser) {
      invalidateCache(`user_type_${currentUser.id}`)
    }
  }, [currentUser])

  const invalidateClientAccess = useCallback(() => {
    if (currentUser) {
      invalidateCache(`client_access_${currentUser.id}`)
      invalidateCache(`accessible_clients_${currentUser.id}`)
    }
  }, [currentUser])

  const invalidatePlanLimits = useCallback((orgId?: string) => {
    if (orgId) {
      invalidateCache(`plan_limits_${orgId}`)
      invalidateCache(`active_subscription_${orgId}`)
    } else if (currentUser) {
      invalidateCache('plan_limits_')
      invalidateCache('active_subscription_')
    }
  }, [currentUser])

  return {
    invalidateAll,
    invalidateUser,
    invalidateUserType,
    invalidateClientAccess,
    invalidatePlanLimits
  }
}