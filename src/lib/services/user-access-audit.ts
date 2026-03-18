import { createClient } from '@/lib/supabase/server'
import { createClient as createClientClient } from '@/lib/supabase/client'

// Event types for audit logging
export enum AuditEventType {
  USER_TYPE_CHANGE = 'user_type_change',
  ACCESS_GRANT = 'access_grant',
  ACCESS_REVOKE = 'access_revoke',
  ACCESS_DENIED = 'access_denied',
  USER_CREATE = 'user_create',
  USER_UPDATE = 'user_update',
  USER_DELETE = 'user_delete',
  LOGIN_ATTEMPT = 'login_attempt',
  PERMISSION_CHECK = 'permission_check',
  PLAN_LIMIT_EXCEEDED = 'plan_limit_exceeded'
}

// Event categories for grouping
export enum AuditEventCategory {
  USER_MANAGEMENT = 'user_management',
  ACCESS_CONTROL = 'access_control',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  SECURITY = 'security'
}

// Resource types
export enum AuditResourceType {
  USER = 'user',
  CLIENT_ACCESS = 'client_access',
  USER_TYPE = 'user_type',
  ORGANIZATION = 'organization',
  CLIENT = 'client',
  CONNECTION = 'connection',
  CAMPAIGN = 'campaign'
}

// Audit log entry interface
export interface AuditLogEntry {
  id?: string
  eventType: AuditEventType
  eventCategory: AuditEventCategory
  actorUserId: string
  targetUserId?: string
  organizationId?: string
  clientId?: string
  action: string
  resourceType?: AuditResourceType
  resourceId?: string
  oldValues?: Record<string, any>
  newValues?: Record<string, any>
  ipAddress?: string
  userAgent?: string
  requestId?: string
  sessionId?: string
  success: boolean
  errorMessage?: string
  errorCode?: string
  metadata?: Record<string, any>
  createdAt?: Date
}

// Audit statistics interface
export interface AuditStatistics {
  period: {
    startDate: Date
    endDate: Date
  }
  summary: {
    totalEvents: number
    successfulEvents: number
    failedEvents: number
    uniqueActors: number
    uniqueTargets: number
  }
  byEventType: Record<string, {
    total: number
    successRate: number
  }>
  byCategory: Record<string, number>
}

// Request context for audit logging
export interface AuditContext {
  ipAddress?: string
  userAgent?: string
  requestId?: string
  sessionId?: string
}

/**
 * UserAccessAuditService - Serviço de auditoria para controle de acesso
 * Requirements: 7.5 - Implementar logging e auditoria
 */
export class UserAccessAuditService {
  private supabase: any

  constructor(isServerSide = true) {
    if (isServerSide) {
      // Será inicializado de forma assíncrona
      this.supabase = null
    } else {
      this.supabase = createClientClient()
    }
  }

  /**
   * Inicializa o cliente Supabase para server-side
   */
  private async initSupabase() {
    if (!this.supabase) {
      this.supabase = await createClient()
    }
    return this.supabase
  }

  /**
   * Log de mudança de tipo de usuário
   * Requirements: 7.5 - Log de todas as mudanças de tipo de usuário
   */
  async logUserTypeChange(
    actorUserId: string,
    targetUserId: string,
    oldUserType: string,
    newUserType: string,
    organizationId?: string,
    context?: AuditContext
  ): Promise<string | null> {
    return this.logEvent({
      eventType: AuditEventType.USER_TYPE_CHANGE,
      eventCategory: AuditEventCategory.USER_MANAGEMENT,
      actorUserId,
      targetUserId,
      organizationId,
      action: `Changed user type from ${oldUserType} to ${newUserType}`,
      resourceType: AuditResourceType.USER_TYPE,
      resourceId: targetUserId,
      oldValues: { userType: oldUserType },
      newValues: { userType: newUserType },
      success: true,
      metadata: {
        changeType: 'user_type_modification',
        previousType: oldUserType,
        newType: newUserType
      },
      ...context
    })
  }

  /**
   * Log de concessão de acesso a cliente
   * Requirements: 7.5 - Log de concessões de acesso
   */
  async logAccessGrant(
    actorUserId: string,
    targetUserId: string,
    clientId: string,
    organizationId: string,
    permissions?: Record<string, any>,
    context?: AuditContext
  ): Promise<string | null> {
    return this.logEvent({
      eventType: AuditEventType.ACCESS_GRANT,
      eventCategory: AuditEventCategory.ACCESS_CONTROL,
      actorUserId,
      targetUserId,
      organizationId,
      clientId,
      action: 'Granted client access',
      resourceType: AuditResourceType.CLIENT_ACCESS,
      resourceId: `${targetUserId}:${clientId}`,
      newValues: { 
        clientId,
        permissions: permissions || { read: true, write: false },
        grantedAt: new Date().toISOString()
      },
      success: true,
      metadata: {
        accessType: 'client_access_grant',
        permissions
      },
      ...context
    })
  }

  /**
   * Log de revogação de acesso a cliente
   * Requirements: 7.5 - Log de revogações de acesso
   */
  async logAccessRevoke(
    actorUserId: string,
    targetUserId: string,
    clientId: string,
    organizationId: string,
    previousPermissions?: Record<string, any>,
    context?: AuditContext
  ): Promise<string | null> {
    return this.logEvent({
      eventType: AuditEventType.ACCESS_REVOKE,
      eventCategory: AuditEventCategory.ACCESS_CONTROL,
      actorUserId,
      targetUserId,
      organizationId,
      clientId,
      action: 'Revoked client access',
      resourceType: AuditResourceType.CLIENT_ACCESS,
      resourceId: `${targetUserId}:${clientId}`,
      oldValues: {
        clientId,
        permissions: previousPermissions || { read: true, write: false },
        revokedAt: new Date().toISOString()
      },
      success: true,
      metadata: {
        accessType: 'client_access_revoke',
        previousPermissions
      },
      ...context
    })
  }

  /**
   * Log de tentativa de acesso negado
   * Requirements: 7.5 - Log de tentativas de acesso negado
   */
  async logAccessDenied(
    actorUserId: string,
    resource: string,
    action: string,
    reason: string,
    organizationId?: string,
    clientId?: string,
    context?: AuditContext
  ): Promise<string | null> {
    return this.logEvent({
      eventType: AuditEventType.ACCESS_DENIED,
      eventCategory: AuditEventCategory.AUTHORIZATION,
      actorUserId,
      organizationId,
      clientId,
      action: `Access denied to ${resource}:${action}`,
      resourceType: this.mapResourceToType(resource),
      resourceId: clientId || organizationId,
      success: false,
      errorMessage: reason,
      errorCode: 'ACCESS_DENIED',
      metadata: {
        deniedResource: resource,
        deniedAction: action,
        denialReason: reason
      },
      ...context
    })
  }

  /**
   * Log de criação de usuário
   */
  async logUserCreate(
    actorUserId: string,
    targetUserId: string,
    organizationId: string,
    userRole: string,
    userData: Record<string, any>,
    context?: AuditContext
  ): Promise<string | null> {
    return this.logEvent({
      eventType: AuditEventType.USER_CREATE,
      eventCategory: AuditEventCategory.USER_MANAGEMENT,
      actorUserId,
      targetUserId,
      organizationId,
      action: 'Created new user',
      resourceType: AuditResourceType.USER,
      resourceId: targetUserId,
      newValues: {
        ...userData,
        role: userRole,
        organizationId
      },
      success: true,
      metadata: {
        operationType: 'user_creation',
        userRole
      },
      ...context
    })
  }

  /**
   * Log de atualização de usuário
   */
  async logUserUpdate(
    actorUserId: string,
    targetUserId: string,
    organizationId: string,
    oldData: Record<string, any>,
    newData: Record<string, any>,
    context?: AuditContext
  ): Promise<string | null> {
    return this.logEvent({
      eventType: AuditEventType.USER_UPDATE,
      eventCategory: AuditEventCategory.USER_MANAGEMENT,
      actorUserId,
      targetUserId,
      organizationId,
      action: 'Updated user information',
      resourceType: AuditResourceType.USER,
      resourceId: targetUserId,
      oldValues: oldData,
      newValues: newData,
      success: true,
      metadata: {
        operationType: 'user_update',
        changedFields: Object.keys(newData)
      },
      ...context
    })
  }

  /**
   * Log de exclusão de usuário
   */
  async logUserDelete(
    actorUserId: string,
    targetUserId: string,
    organizationId: string,
    userData: Record<string, any>,
    context?: AuditContext
  ): Promise<string | null> {
    return this.logEvent({
      eventType: AuditEventType.USER_DELETE,
      eventCategory: AuditEventCategory.USER_MANAGEMENT,
      actorUserId,
      targetUserId,
      organizationId,
      action: 'Deleted user',
      resourceType: AuditResourceType.USER,
      resourceId: targetUserId,
      oldValues: userData,
      success: true,
      metadata: {
        operationType: 'user_deletion',
        cascadeCleanup: true
      },
      ...context
    })
  }

  /**
   * Log de limite de plano excedido
   */
  async logPlanLimitExceeded(
    actorUserId: string,
    organizationId: string,
    limitType: string,
    currentUsage: number,
    limit: number,
    context?: AuditContext
  ): Promise<string | null> {
    return this.logEvent({
      eventType: AuditEventType.PLAN_LIMIT_EXCEEDED,
      eventCategory: AuditEventCategory.AUTHORIZATION,
      actorUserId,
      organizationId,
      action: `Plan limit exceeded for ${limitType}`,
      resourceType: AuditResourceType.ORGANIZATION,
      resourceId: organizationId,
      success: false,
      errorMessage: `${limitType} limit of ${limit} exceeded (current: ${currentUsage})`,
      errorCode: 'PLAN_LIMIT_EXCEEDED',
      metadata: {
        limitType,
        currentUsage,
        limit,
        exceedBy: currentUsage - limit
      },
      ...context
    })
  }

  /**
   * Log genérico de evento
   */
  async logEvent(entry: AuditLogEntry): Promise<string | null> {
    const supabase = await this.initSupabase()
    
    try {
      const { data, error } = await supabase.rpc('log_user_access_event', {
        p_event_type: entry.eventType,
        p_event_category: entry.eventCategory,
        p_actor_user_id: entry.actorUserId,
        p_target_user_id: entry.targetUserId || null,
        p_organization_id: entry.organizationId || null,
        p_client_id: entry.clientId || null,
        p_action: entry.action,
        p_resource_type: entry.resourceType || null,
        p_resource_id: entry.resourceId || null,
        p_old_values: entry.oldValues || null,
        p_new_values: entry.newValues || null,
        p_ip_address: entry.ipAddress || null,
        p_user_agent: entry.userAgent || null,
        p_request_id: entry.requestId || null,
        p_session_id: entry.sessionId || null,
        p_success: entry.success,
        p_error_message: entry.errorMessage || null,
        p_error_code: entry.errorCode || null,
        p_metadata: entry.metadata || {}
      })

      if (error) {
        console.error('Erro ao registrar evento de auditoria:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Erro ao registrar evento de auditoria:', error)
      return null
    }
  }

  /**
   * Buscar logs de auditoria com filtros
   */
  async getAuditLogs(filters: {
    organizationId?: string
    actorUserId?: string
    targetUserId?: string
    eventType?: AuditEventType
    eventCategory?: AuditEventCategory
    startDate?: Date
    endDate?: Date
    success?: boolean
    limit?: number
    offset?: number
  } = {}): Promise<AuditLogEntry[]> {
    const supabase = await this.initSupabase()
    
    try {
      let query = supabase
        .from('user_access_audit_log_detailed')
        .select(`
          id,
          event_type,
          event_category,
          actor_user_id,
          target_user_id,
          organization_id,
          client_id,
          action,
          resource_type,
          resource_id,
          old_values,
          new_values,
          ip_address,
          user_agent,
          request_id,
          session_id,
          success,
          error_message,
          error_code,
          metadata,
          created_at,
          actor_email,
          actor_name,
          target_email,
          target_name,
          organization_name,
          client_name
        `)
        .order('created_at', { ascending: false })

      // Apply filters
      if (filters.organizationId) {
        query = query.eq('organization_id', filters.organizationId)
      }
      if (filters.actorUserId) {
        query = query.eq('actor_user_id', filters.actorUserId)
      }
      if (filters.targetUserId) {
        query = query.eq('target_user_id', filters.targetUserId)
      }
      if (filters.eventType) {
        query = query.eq('event_type', filters.eventType)
      }
      if (filters.eventCategory) {
        query = query.eq('event_category', filters.eventCategory)
      }
      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate.toISOString())
      }
      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate.toISOString())
      }
      if (filters.success !== undefined) {
        query = query.eq('success', filters.success)
      }

      // Apply pagination
      if (filters.limit) {
        query = query.limit(filters.limit)
      }
      if (filters.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1)
      }

      const { data, error } = await query

      if (error) {
        console.error('Erro ao buscar logs de auditoria:', error)
        return []
      }

      return data.map(this.mapDatabaseToAuditEntry)
    } catch (error) {
      console.error('Erro ao buscar logs de auditoria:', error)
      return []
    }
  }

  /**
   * Obter estatísticas de auditoria
   */
  async getAuditStatistics(
    organizationId?: string,
    startDate: Date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    endDate: Date = new Date()
  ): Promise<AuditStatistics | null> {
    const supabase = await this.initSupabase()
    
    try {
      const { data, error } = await supabase.rpc('get_audit_statistics', {
        p_organization_id: organizationId || null,
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString()
      })

      if (error) {
        console.error('Erro ao obter estatísticas de auditoria:', error)
        return null
      }

      return {
        period: {
          startDate: new Date(data.period.start_date),
          endDate: new Date(data.period.end_date)
        },
        summary: data.summary,
        byEventType: data.by_event_type || {},
        byCategory: data.by_category || {}
      }
    } catch (error) {
      console.error('Erro ao obter estatísticas de auditoria:', error)
      return null
    }
  }

  /**
   * Limpar logs antigos (para manutenção)
   */
  async cleanupOldLogs(retentionDays: number = 365): Promise<number> {
    const supabase = await this.initSupabase()
    
    try {
      const { data, error } = await supabase.rpc('cleanup_old_audit_logs', {
        p_retention_days: retentionDays
      })

      if (error) {
        console.error('Erro ao limpar logs antigos:', error)
        return 0
      }

      return data || 0
    } catch (error) {
      console.error('Erro ao limpar logs antigos:', error)
      return 0
    }
  }

  /**
   * Mapear tipo de recurso
   */
  private mapResourceToType(resource: string): AuditResourceType {
    switch (resource.toLowerCase()) {
      case 'users':
        return AuditResourceType.USER
      case 'clients':
        return AuditResourceType.CLIENT
      case 'connections':
        return AuditResourceType.CONNECTION
      case 'campaigns':
        return AuditResourceType.CAMPAIGN
      case 'organizations':
        return AuditResourceType.ORGANIZATION
      default:
        return AuditResourceType.USER
    }
  }

  /**
   * Mapear dados do banco para interface
   */
  private mapDatabaseToAuditEntry(data: any): AuditLogEntry {
    return {
      id: data.id,
      eventType: data.event_type as AuditEventType,
      eventCategory: data.event_category as AuditEventCategory,
      actorUserId: data.actor_user_id,
      targetUserId: data.target_user_id,
      organizationId: data.organization_id,
      clientId: data.client_id,
      action: data.action,
      resourceType: data.resource_type as AuditResourceType,
      resourceId: data.resource_id,
      oldValues: data.old_values,
      newValues: data.new_values,
      ipAddress: data.ip_address,
      userAgent: data.user_agent,
      requestId: data.request_id,
      sessionId: data.session_id,
      success: data.success,
      errorMessage: data.error_message,
      errorCode: data.error_code,
      metadata: {
        ...data.metadata,
        actorEmail: data.actor_email,
        actorName: data.actor_name,
        targetEmail: data.target_email,
        targetName: data.target_name,
        organizationName: data.organization_name,
        clientName: data.client_name
      },
      createdAt: new Date(data.created_at)
    }
  }

  /**
   * Métodos estáticos para uso em middleware
   */
  static async logAccessDenied(
    actorUserId: string,
    resource: string,
    action: string,
    reason: string,
    organizationId?: string,
    clientId?: string,
    context?: AuditContext
  ): Promise<void> {
    const service = new UserAccessAuditService()
    await service.logAccessDenied(actorUserId, resource, action, reason, organizationId, clientId, context)
  }

  static async logUserTypeChange(
    actorUserId: string,
    targetUserId: string,
    oldUserType: string,
    newUserType: string,
    organizationId?: string,
    context?: AuditContext
  ): Promise<void> {
    const service = new UserAccessAuditService()
    await service.logUserTypeChange(actorUserId, targetUserId, oldUserType, newUserType, organizationId, context)
  }

  static async logAccessGrant(
    actorUserId: string,
    targetUserId: string,
    clientId: string,
    organizationId: string,
    permissions?: Record<string, any>,
    context?: AuditContext
  ): Promise<void> {
    const service = new UserAccessAuditService()
    await service.logAccessGrant(actorUserId, targetUserId, clientId, organizationId, permissions, context)
  }

  static async logAccessRevoke(
    actorUserId: string,
    targetUserId: string,
    clientId: string,
    organizationId: string,
    previousPermissions?: Record<string, any>,
    context?: AuditContext
  ): Promise<void> {
    const service = new UserAccessAuditService()
    await service.logAccessRevoke(actorUserId, targetUserId, clientId, organizationId, previousPermissions, context)
  }
}

// Export for backward compatibility
export const UserAccessAudit = UserAccessAuditService