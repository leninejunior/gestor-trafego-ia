/**
 * Auth Module Index
 * Exporta todas as funcionalidades do módulo Auth
 */

export { 
  isSuperAdmin, 
  isCurrentUserSuperAdmin, 
  requireSuperAdmin,
  useSuperAdmin 
} from './super-admin';

export type {
  // Add auth-related types here if needed
} from './super-admin';