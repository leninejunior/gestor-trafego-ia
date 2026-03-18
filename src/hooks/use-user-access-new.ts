'use client'

import { 
  useUserAccess, 
  useUserType, 
  useClientAccess, 
  usePlanLimits,
  useIsSuperAdmin,
  useIsOrgAdmin,
  useIsCommonUser
} from './use-user-access'
import { UserType, PlanLimits } from '@/lib/services/user-access-control'

interface UseUserAccessResult {
  userType: UserType | null
  planLimits: PlanLimits | null
  loading: boolean
  error: string | null
  isSuperAdmin: boolean
  isOrgAdmin: boolean
  isCommonUser: boolean
  checkPermission: (resourceType: string, action: string, resourceId?: string) => Promise<boolean>
  hasClientAccess: (clientId: string) => Promise<boolean>
  getUserAccessibleClients: () => Promise<any[]>
  canCreateClients: boolean
  canCreateConnections: boolean
  canCreateUsers: boolean
  hasActiveSubscription: boolean
  refresh: () => Promise<void>
}

/**
 * Hook para gerenciar controle de acesso do usuário no frontend
 * Baseado no novo sistema de controle de acesso hierárquico
 * 
 * @deprecated Use the individual hooks (useUserType, useClientAccess, usePlanLimits) instead
 * This hook is maintained for backward compatibility
 */
export function useUserAccessNew(): UseUserAccessResult {
  const { checkPermission, hasClientAccess, getUserAccessibleClients, refresh: refreshAccess } = useUserAccess()
  const { userType, loading: userTypeLoading, error: userTypeError, isSuperAdmin, isOrgAdmin, isCommonUser } = useUserType()
  const { 
    planLimits, 
    hasActiveSubscription, 
    canCreateUsers, 
    canCreateClients, 
    canCreateConnections,
    loading: planLimitsLoading, 
    error: planLimitsError,
    refresh: refreshPlanLimits
  } = usePlanLimits()

  const loading = userTypeLoading || planLimitsLoading
  const error = userTypeError || planLimitsError

  const refresh = async () => {
    refreshAccess()
    refreshPlanLimits()
  }

  return {
    userType,
    planLimits,
    loading,
    error,
    isSuperAdmin,
    isOrgAdmin,
    isCommonUser,
    checkPermission,
    hasClientAccess,
    getUserAccessibleClients,
    canCreateClients,
    canCreateConnections,
    canCreateUsers,
    hasActiveSubscription,
    refresh
  }
}

// Re-export the new individual hooks for convenience
export {
  useUserAccess,
  useUserType,
  useClientAccess,
  usePlanLimits,
  useAccessControlCache
} from './use-user-access'