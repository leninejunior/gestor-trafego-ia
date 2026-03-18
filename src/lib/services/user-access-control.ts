import { createClient } from '@/lib/supabase/server'
import { createClient as createClientClient } from '@/lib/supabase/client'
import { userAccessCache, UserAccessCacheKeyBuilder, USER_ACCESS_CACHE_TTL } from './user-access-cache'

// UserType enum as specified in design document
export enum UserType {
  SUPER_ADMIN = 'super_admin',
  ORG_ADMIN = 'org_admin',
  COMMON_USER = 'common_user'
}

export type ResourceType = 'users' | 'clients' | 'connections' | 'campaigns' | 'reports'
export type Action = 'create' | 'read' | 'update' | 'delete'
export type LimitedAction = 'create_user' | 'create_client' | 'create_connection' | 'create_campaign'

export interface PlanLimits {
  maxUsers: number | null // null = unlimited
  maxClients: number | null
  maxConnections: number | null
  maxCampaigns: number | null
  currentUsage: {
    users: number
    clients: number
    connections: number
    campaigns: number
  }
}

export interface Client {
  id: string
  name: string
  orgId: string
  isActive: boolean
}

export interface PermissionResult {
  allowed: boolean
  reason?: string
  userType: UserType
  limits?: PlanLimits
}

export interface ValidationResult {
  valid: boolean
  reason?: string
  currentUsage?: number
  limit?: number
}

/**
 * UserAccessControlService - Serviço de controle de acesso hierárquico
 * Implementa os requisitos do sistema de controle de acesso conforme design document
 */
export class UserAccessControlService {
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
   * Determina o tipo de usuário baseado nas tabelas super_admins e memberships
   * Requirements: 1.1, 1.2, 1.3
   * Cache TTL: 5 minutes
   */
  async getUserType(userId: string): Promise<UserType> {
    // Try cache first
    const cachedType = await userAccessCache.getUserType(userId)
    if (cachedType !== null) {
      return cachedType
    }

    const supabase = await this.initSupabase()
    
    try {
      // Verificar se é super admin PRIMEIRO
      const { data: superAdmin, error: superAdminError } = await supabase
        .from('super_admins')
        .select('id, is_active')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single()

      if (!superAdminError && superAdmin) {
        await userAccessCache.setUserType(userId, UserType.SUPER_ADMIN)
        return UserType.SUPER_ADMIN
      }

      // Verificar se é admin de organização
      const { data: membership, error: membershipError } = await supabase
        .from('memberships')
        .select('role, organization_id')
        .eq('user_id', userId)
        .single()

      if (!membershipError && membership) {
        if (membership.role === 'admin') {
          await userAccessCache.setUserType(userId, UserType.ORG_ADMIN)
          return UserType.ORG_ADMIN
        } else {
          // Usuário tem membership mas não é admin
          await userAccessCache.setUserType(userId, UserType.COMMON_USER)
          return UserType.COMMON_USER
        }
      }

      // Default: usuário comum (pode não ter membership ainda)
      await userAccessCache.setUserType(userId, UserType.COMMON_USER)
      return UserType.COMMON_USER
    } catch (error) {
      console.error('Erro ao determinar tipo de usuário:', error)
      // Cache the default result to avoid repeated failures
      await userAccessCache.setUserType(userId, UserType.COMMON_USER)
      return UserType.COMMON_USER
    }
  }

  /**
   * Verifica se o usuário é super admin
   * Requirements: 1.1, 1.5
   */
  async isSuperAdmin(userId: string): Promise<boolean> {
    const userType = await this.getUserType(userId)
    return userType === UserType.SUPER_ADMIN
  }

  /**
   * Verifica se o usuário é admin de uma organização específica
   * Requirements: 2.1, 2.3, 2.5
   * Cache TTL: 5 minutes
   */
  async isOrgAdmin(userId: string, orgId: string): Promise<boolean> {
    // Try cache first
    const cachedResult = await userAccessCache.getOrgMembership(userId, orgId)
    if (cachedResult !== null) {
      return cachedResult
    }

    const supabase = await this.initSupabase()
    
    try {
      const { data: membership, error } = await supabase
        .from('memberships')
        .select('role')
        .eq('user_id', userId)
        .eq('organization_id', orgId)
        .eq('role', 'admin')
        .single()

      const isAdmin = !error && !!membership
      
      // Cache the result
      await userAccessCache.setOrgMembership(userId, orgId, isAdmin)
      
      return isAdmin
    } catch (error) {
      console.error('Erro ao verificar admin de organização:', error)
      // Cache negative result to avoid repeated failures
      await userAccessCache.setOrgMembership(userId, orgId, false)
      return false
    }
  }

  /**
   * Obtém os limites de plano de uma organização
   * Requirements: 4.1, 4.2, 4.3, 4.5
   * Cache TTL: 10 minutes
   */
  async getOrganizationLimits(orgId: string): Promise<PlanLimits> {
    // Try cache first
    const cachedLimits = await userAccessCache.getPlanLimits(orgId)
    if (cachedLimits !== null) {
      return cachedLimits
    }

    const supabase = await this.initSupabase()
    
    try {
      // Buscar assinatura ativa da organização
      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .select(`
          status,
          current_period_end,
          subscription_plans (
            max_users,
            max_clients,
            max_connections,
            max_campaigns
          )
        `)
        .eq('organization_id', orgId)
        .eq('status', 'active')
        .single()

      let limits = {
        maxUsers: 1,
        maxClients: 1,
        maxConnections: 1,
        maxCampaigns: 5
      }

      // Check if subscription exists and is not expired
      const hasValidSubscription = !subError && 
        subscription?.subscription_plans && 
        subscription.status === 'active' &&
        new Date(subscription.current_period_end) > new Date()

      if (hasValidSubscription) {
        const plan = subscription.subscription_plans
        limits = {
          maxUsers: plan.max_users,
          maxClients: plan.max_clients,
          maxConnections: plan.max_connections,
          maxCampaigns: plan.max_campaigns
        }
      }

      // Calcular uso atual
      const [usersCount, clientsCount, connectionsCount, campaignsCount] = await Promise.all([
        this.countOrganizationUsers(orgId),
        this.countOrganizationClients(orgId),
        this.countOrganizationConnections(orgId),
        this.countOrganizationCampaigns(orgId)
      ])

      const planLimits: PlanLimits = {
        ...limits,
        currentUsage: {
          users: usersCount,
          clients: clientsCount,
          connections: connectionsCount,
          campaigns: campaignsCount
        }
      }

      // Cache the result
      await userAccessCache.setPlanLimits(orgId, planLimits)

      return planLimits
    } catch (error) {
      console.error('Erro ao obter limites da organização:', error)
      const defaultLimits: PlanLimits = {
        maxUsers: 1,
        maxClients: 1,
        maxConnections: 1,
        maxCampaigns: 5,
        currentUsage: {
          users: 0,
          clients: 0,
          connections: 0,
          campaigns: 0
        }
      }
      
      // Cache default limits to avoid repeated failures
      await userAccessCache.setPlanLimits(orgId, defaultLimits)
      return defaultLimits
    }
  }

  /**
   * Verifica se a organização tem uma assinatura ativa e não expirada
   * Requirements: 4.4
   * Cache TTL: 10 minutes
   */
  async hasActiveSubscription(orgId: string): Promise<boolean> {
    // Try cache first
    const cachedResult = await userAccessCache.getActiveSubscription(orgId)
    if (cachedResult !== null) {
      return cachedResult
    }

    const supabase = await this.initSupabase()
    
    try {
      const { data: subscription, error } = await supabase
        .from('subscriptions')
        .select('status, current_period_end')
        .eq('organization_id', orgId)
        .eq('status', 'active')
        .single()

      if (error || !subscription) {
        await userAccessCache.setActiveSubscription(orgId, false)
        return false
      }

      // Check if subscription is not expired
      const isActive = new Date(subscription.current_period_end) > new Date()
      
      // Cache the result
      await userAccessCache.setActiveSubscription(orgId, isActive)
      
      return isActive
    } catch (error) {
      console.error('Erro ao verificar assinatura ativa:', error)
      // Cache negative result to avoid repeated failures
      await userAccessCache.setActiveSubscription(orgId, false)
      return false
    }
  }

  /**
   * Valida se uma ação pode ser executada considerando os limites do plano
   * Requirements: 4.1, 4.2, 4.3, 4.4
   */
  async validateActionAgainstLimits(
    orgId: string,
    action: LimitedAction
  ): Promise<ValidationResult> {
    // First check if subscription is active and not expired
    const hasActiveSubscription = await this.hasActiveSubscription(orgId)
    
    if (!hasActiveSubscription) {
      return {
        valid: false,
        reason: 'Assinatura expirada ou inativa. Não é possível criar novos recursos.',
        currentUsage: 0,
        limit: 0
      }
    }

    const limits = await this.getOrganizationLimits(orgId)
    
    switch (action) {
      case 'create_user':
        if (limits.maxUsers === null) return { valid: true }
        return {
          valid: limits.currentUsage.users < limits.maxUsers,
          reason: limits.currentUsage.users >= limits.maxUsers ? 'Limite de usuários atingido' : undefined,
          currentUsage: limits.currentUsage.users,
          limit: limits.maxUsers
        }
      
      case 'create_client':
        if (limits.maxClients === null) return { valid: true }
        return {
          valid: limits.currentUsage.clients < limits.maxClients,
          reason: limits.currentUsage.clients >= limits.maxClients ? 'Limite de clientes atingido' : undefined,
          currentUsage: limits.currentUsage.clients,
          limit: limits.maxClients
        }
      
      case 'create_connection':
        if (limits.maxConnections === null) return { valid: true }
        return {
          valid: limits.currentUsage.connections < limits.maxConnections,
          reason: limits.currentUsage.connections >= limits.maxConnections ? 'Limite de conexões atingido' : undefined,
          currentUsage: limits.currentUsage.connections,
          limit: limits.maxConnections
        }
      
      case 'create_campaign':
        if (limits.maxCampaigns === null) return { valid: true }
        return {
          valid: limits.currentUsage.campaigns < limits.maxCampaigns,
          reason: limits.currentUsage.campaigns >= limits.maxCampaigns ? 'Limite de campanhas atingido' : undefined,
          currentUsage: limits.currentUsage.campaigns,
          limit: limits.maxCampaigns
        }
      
      default:
        return { valid: true }
    }
  }

  /**
   * Verifica se o usuário tem permissão para acessar um recurso
   * Requirements: 8.1, 8.2, 8.3, 8.4
   */
  async checkPermission(
    userId: string,
    resource: ResourceType,
    action: Action,
    resourceId?: string
  ): Promise<PermissionResult> {
    const supabase = await this.initSupabase()
    
    try {
      const userType = await this.getUserType(userId)
      
      // Super admins têm acesso total
      if (userType === UserType.SUPER_ADMIN) {
        return {
          allowed: true,
          userType
        }
      }

      // Para recursos específicos de cliente, verificar acesso
      if (resourceId && (resource === 'clients' || resource === 'campaigns' || resource === 'reports')) {
        const hasAccess = await this.hasClientAccess(userId, resourceId)
        if (!hasAccess) {
          return {
            allowed: false,
            reason: 'Acesso negado: você não tem permissão para acessar este cliente',
            userType
          }
        }
      }

      // Verificar permissões baseadas no tipo de usuário e ação
      const allowed = this.checkUserActionPermission(userType, resource, action)
      
      return {
        allowed,
        reason: allowed ? undefined : this.getAccessDeniedReason(userType, resource, action),
        userType
      }
    } catch (error) {
      console.error('Erro ao verificar permissão:', error)
      return {
        allowed: false,
        reason: 'Erro interno',
        userType: UserType.COMMON_USER
      }
    }
  }

  /**
   * Verifica permissões baseadas no tipo de usuário e ação
   */
  private checkUserActionPermission(userType: UserType, resource: ResourceType, action: Action): boolean {
    switch (userType) {
      case UserType.SUPER_ADMIN:
        return true // Super admins podem tudo
      
      case UserType.ORG_ADMIN:
        // Org admins podem gerenciar usuários, clientes e conexões da sua org
        if (resource === 'users' || resource === 'clients' || resource === 'connections') {
          return true
        }
        // Podem ler campanhas e relatórios
        if ((resource === 'campaigns' || resource === 'reports') && action === 'read') {
          return true
        }
        return false
      
      case UserType.COMMON_USER:
        // Usuários comuns só podem ler campanhas e relatórios dos clientes autorizados
        if ((resource === 'campaigns' || resource === 'reports') && action === 'read') {
          return true
        }
        return false
      
      default:
        return false
    }
  }

  /**
   * Obtém lista de clientes que o usuário pode acessar
   * Requirements: 5.1, 5.2, 5.3, 5.4
   * Cache TTL: 2 minutes
   */
  async getUserAccessibleClients(userId: string): Promise<Client[]> {
    // Try cache first
    const cachedClients = await userAccessCache.getClientAccess(userId)
    if (cachedClients !== null) {
      return cachedClients
    }

    const supabase = await this.initSupabase()
    const userType = await this.getUserType(userId)
    
    try {
      let clients: Client[] = []

      if (userType === UserType.SUPER_ADMIN) {
        // Super admins veem todos os clientes
        const { data: clientsData, error } = await supabase
          .from('clients')
          .select('id, name, org_id, is_active')
          .eq('is_active', true)

        if (error) throw error
        clients = clientsData.map(c => ({ id: c.id, name: c.name, orgId: c.org_id, isActive: c.is_active }))
      } else if (userType === UserType.ORG_ADMIN) {
        // Org admins veem clientes da sua organização
        const { data: clientsData, error } = await supabase
          .from('clients')
          .select(`
            id, name, org_id, is_active,
            organizations!inner (
              memberships!inner (
                user_id
              )
            )
          `)
          .eq('organizations.memberships.user_id', userId)
          .eq('is_active', true)

        if (error) throw error
        clients = clientsData.map(c => ({ id: c.id, name: c.name, orgId: c.org_id, isActive: c.is_active }))
      } else {
        // Usuários comuns veem apenas clientes com acesso explícito
        const { data: clientAccess, error } = await supabase
          .from('user_client_access')
          .select(`
            clients!inner (
              id, name, org_id, is_active
            )
          `)
          .eq('user_id', userId)
          .eq('is_active', true)
          .eq('clients.is_active', true)

        if (error) throw error
        clients = clientAccess.map(ca => ({ 
          id: ca.clients.id, 
          name: ca.clients.name, 
          orgId: ca.clients.org_id, 
          isActive: ca.clients.is_active 
        }))
      }

      // Cache the result
      await userAccessCache.setClientAccess(userId, clients)

      return clients
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      const errorDetails = error instanceof Error ? error.stack : JSON.stringify(error)
      console.error('Erro ao obter clientes acessíveis:', {
        message: errorMessage,
        details: errorDetails,
        userId,
        userType
      })
      // Cache empty result to avoid repeated failures
      await userAccessCache.setClientAccess(userId, [])
      return []
    }
  }

  /**
   * Verifica se o usuário tem acesso a um cliente específico
   * Requirements: 5.1, 5.2, 5.3, 5.4, 6.5
   * Cache TTL: 2 minutes
   */
  async hasClientAccess(userId: string, clientId: string): Promise<boolean> {
    // Try cache first
    const cachedResult = await userAccessCache.getHasClientAccess(userId, clientId)
    if (cachedResult !== null) {
      return cachedResult
    }

    const supabase = await this.initSupabase()
    const userType = await this.getUserType(userId)

    try {
      let hasAccess = false

      // Super admins têm acesso a tudo
      if (userType === UserType.SUPER_ADMIN) {
        hasAccess = true
      } else if (userType === UserType.ORG_ADMIN) {
        // Org admins têm acesso aos clientes da sua organização
        const { data, error } = await supabase
          .from('clients')
          .select(`
            id,
            organizations!inner (
              memberships!inner (
                user_id
              )
            )
          `)
          .eq('id', clientId)
          .eq('organizations.memberships.user_id', userId)
          .eq('organizations.memberships.role', 'admin')
          .single()

        hasAccess = !error && !!data
      } else {
        // Usuários comuns: verificar acesso explícito na tabela user_client_access
        const { data, error } = await supabase
          .from('user_client_access')
          .select('id')
          .eq('user_id', userId)
          .eq('client_id', clientId)
          .eq('is_active', true)
          .single()

        hasAccess = !error && !!data
      }

      // Cache the result
      await userAccessCache.setHasClientAccess(userId, clientId, hasAccess)

      return hasAccess
    } catch (error) {
      console.error('Erro ao verificar acesso ao cliente:', error)
      // Cache negative result to avoid repeated failures
      await userAccessCache.setHasClientAccess(userId, clientId, false)
      return false
    }
  }

  /**
   * Métodos auxiliares para contar recursos da organização
   */
  private async countOrganizationUsers(orgId: string): Promise<number> {
    const supabase = await this.initSupabase()
    
    try {
      const { count, error } = await supabase
        .from('memberships')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)

      return error ? 0 : (count || 0)
    } catch (error) {
      return 0
    }
  }

  private async countOrganizationClients(orgId: string): Promise<number> {
    const supabase = await this.initSupabase()
    
    try {
      const { count, error } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('is_active', true)

      return error ? 0 : (count || 0)
    } catch (error) {
      return 0
    }
  }

  private async countOrganizationConnections(orgId: string): Promise<number> {
    const supabase = await this.initSupabase()
    
    try {
      // Contar conexões Meta e Google Ads
      const [metaCount, googleCount] = await Promise.all([
        supabase
          .from('client_meta_connections')
          .select('*', { count: 'exact', head: true })
          .eq('clients.org_id', orgId)
          .eq('is_active', true),
        supabase
          .from('google_ads_connections')
          .select('*', { count: 'exact', head: true })
          .eq('clients.org_id', orgId)
          .eq('is_active', true)
      ])

      const metaTotal = metaCount.error ? 0 : (metaCount.count || 0)
      const googleTotal = googleCount.error ? 0 : (googleCount.count || 0)
      
      return metaTotal + googleTotal
    } catch (error) {
      return 0
    }
  }

  private async countOrganizationCampaigns(orgId: string): Promise<number> {
    const supabase = await this.initSupabase()
    
    try {
      // Contar campanhas Meta e Google Ads
      const [metaCount, googleCount] = await Promise.all([
        supabase
          .from('meta_campaigns')
          .select('*', { count: 'exact', head: true })
          .eq('clients.org_id', orgId),
        supabase
          .from('google_ads_campaigns')
          .select('*', { count: 'exact', head: true })
          .eq('clients.org_id', orgId)
      ])

      const metaTotal = metaCount.error ? 0 : (metaCount.count || 0)
      const googleTotal = googleCount.error ? 0 : (googleCount.count || 0)
      
      return metaTotal + googleTotal
    } catch (error) {
      return 0
    }
  }

  /**
   * Métodos estáticos para middleware de API
   */
  static async requireAccess(
    userId: string,
    resource: ResourceType,
    action: Action,
    resourceId?: string
  ): Promise<PermissionResult> {
    const service = new UserAccessControlService()
    return await service.checkPermission(userId, resource, action, resourceId)
  }

  static async requireSuperAdmin(userId: string): Promise<boolean> {
    const service = new UserAccessControlService()
    return await service.isSuperAdmin(userId)
  }

  static async requireOrgAdmin(userId: string, orgId: string): Promise<boolean> {
    const service = new UserAccessControlService()
    return await service.isOrgAdmin(userId, orgId)
  }

  /**
   * Obtém mensagem de acesso negado baseada no contexto
   */
  private getAccessDeniedReason(userType: UserType, resource: ResourceType, action: Action): string {
    switch (userType) {
      case UserType.COMMON_USER:
        if (action !== 'read') {
          return 'Usuários comuns têm acesso apenas de leitura'
        }
        return 'Acesso negado: você só pode visualizar dados dos clientes autorizados'
      
      case UserType.ORG_ADMIN:
        if (resource === 'users' && action === 'create') {
          return 'Limite de usuários atingido ou plano expirado'
        }
        return 'Acesso negado: ação não permitida para admin de organização'
      
      default:
        return 'Acesso negado'
    }
  }

}

/**
 * Hook para usar no frontend (client-side)
 */
export function useUserAccessControl() {
  const service = new UserAccessControlService(false)

  return {
    getUserType: (userId: string) => service.getUserType(userId),
    isSuperAdmin: (userId: string) => service.isSuperAdmin(userId),
    isOrgAdmin: (userId: string, orgId: string) => service.isOrgAdmin(userId, orgId),
    checkPermission: (userId: string, resource: ResourceType, action: Action, resourceId?: string) =>
      service.checkPermission(userId, resource, action, resourceId),
    getUserAccessibleClients: (userId: string) => service.getUserAccessibleClients(userId),
    hasClientAccess: (userId: string, clientId: string) => service.hasClientAccess(userId, clientId),
    getOrganizationLimits: (orgId: string) => service.getOrganizationLimits(orgId),
    hasActiveSubscription: (orgId: string) => service.hasActiveSubscription(orgId),
    validateActionAgainstLimits: (orgId: string, action: LimitedAction) => 
      service.validateActionAgainstLimits(orgId, action)
  }
}

// Backward compatibility - export the service as UserAccessControl as well
export const UserAccessControl = UserAccessControlService