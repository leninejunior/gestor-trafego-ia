/**
 * Middleware Index
 * Exporta todos os middlewares de controle de acesso
 */

// User Access Control Middleware
export {
  withUserAccessControl,
  requireSuperAdmin,
  requireOrgAdmin,
  requireAnyAdmin,
  requireClientAccess,
  validatePlanLimit,
  createAccessControl,
  getUserFromAccessContext,
  isSuperAdminInContext,
  isOrgAdminInContext,
  isCommonUserInContext,
  getUserLimitsFromContext,
  getOrganizationFromContext,
  validateOrganizationAccess,
  extractClientId,
  extractOrganizationId,
  createAccessDeniedResponse,
  createPlanLimitResponse,
  hasSuperAdminBypass,
  addContextHeaders,
  type AccessControlOptions,
  type AccessControlContext
} from './user-access-middleware'

// Super Admin Middleware
export {
  superAdminMiddleware,
  isSuperAdminRequest,
  getDataForSuperAdmin
} from './super-admin-middleware'

// Plan Limits Middleware
export {
  PlanLimitsService,
  checkPlanLimits,
  checkPlanFeature,
  type PlanLimits,
  type UsageStats
} from './plan-limits'

// Admin Auth Middleware
export {
  requireAdminAuth,
  requireAuth,
  type AuthenticatedUser
} from './admin-auth'

// Re-export types from services
export {
  UserType,
  type ResourceType,
  type Action,
  type LimitedAction,
  type PermissionResult,
  type ValidationResult
} from '@/lib/services/user-access-control'
