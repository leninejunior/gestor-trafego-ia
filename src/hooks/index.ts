/**
 * Hooks Module Index
 * Exporta todos os hooks customizados disponíveis
 */

// User Access Control Hooks
export {
  useUserAccess,
  useUserType,
  useClientAccess,
  usePlanLimits,
  useIsSuperAdmin,
  useIsOrgAdmin,
  useIsCommonUser,
  useAccessControlCache
} from './use-user-access'

// Backward compatibility
export {
  useUserAccessNew,
  useUserAccess as useUserAccessControl,
  useUserType as useUserTypeControl,
  useClientAccess as useClientAccessControl,
  usePlanLimits as usePlanLimitsControl
} from './use-user-access-new'

// Cache Management Hook
export { useCacheManagement } from './use-cache-management'

// Other hooks
export { useIsMobile } from './use-mobile'
export { useUser } from './use-user'