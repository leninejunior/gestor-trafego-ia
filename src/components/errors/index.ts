/**
 * Access Control Error Handling Components
 * 
 * Provides comprehensive error handling and user feedback for the access control system.
 * Implements requirements 6.1, 9.4, 9.5 from the design document.
 */

// Error types and handlers
export {
  AccessControlErrorCode,
  AccessControlErrorHandler,
  type AccessControlError,
  type AccessControlErrorDetails,
  type AccessControlErrorAction
} from '@/lib/errors/access-control-errors'

// Error display components
export {
  AccessControlErrorDisplay
} from './access-control-error-display'

// Error boundary
export {
  AccessControlErrorBoundary,
  AccessControlErrorWrapper,
  withAccessControlErrorBoundary,
  AccessControlErrorConfigProvider,
  useAccessControlErrorBoundary,
  useAccessControlErrorConfig
} from './access-control-error-boundary'

// Feedback components
export {
  PlanLimitFeedback,
  usePlanLimitFeedback
} from '../feedback/plan-limit-feedback'

export {
  RestrictionTooltip,
  UserTypeRestrictionTooltip,
  PlanLimitRestrictionTooltip,
  ClientAccessRestrictionTooltip,
  SubscriptionRestrictionTooltip
} from '../feedback/restriction-tooltip'

// Notification system
export {
  PermissionNotificationProvider,
  PermissionNotificationList,
  PermissionNotificationItem,
  PermissionNotificationBadge,
  usePermissionNotifications,
  usePermissionNotificationHelpers,
  type PermissionNotification
} from '../notifications/permission-notifications'

// Utility functions
export {
  redirectTo403,
  errorRedirects,
  useErrorRedirect,
  createErrorRedirectResponse,
  extractErrorFromResponse,
  isAccessControlError,
  createAccessControlInterceptor
} from '@/lib/utils/error-redirect'
