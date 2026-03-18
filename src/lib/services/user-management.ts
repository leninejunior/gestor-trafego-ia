import { createClient } from '../supabase/server'
import { UserAccessControlService, UserType } from './user-access-control'
import { UserAccessCacheInvalidator } from './user-access-cache'
import { UserAccessAuditService, AuditContext } from './user-access-audit'

export interface CreateUserData {
  email: string
  name: string
  role: 'admin' | 'member'
  organizationId?: string // Optional for super admin
}

export interface UpdateUserData {
  name?: string
  role?: 'admin' | 'member'
  isActive?: boolean
}

export interface User {
  id: string
  email: string
  name: string
  userType: UserType
  organizations: Array<{
    id: string
    name: string
    role: 'admin' | 'member'
  }>
  createdAt: Date
  updatedAt: Date
  isActive: boolean
}

export interface ClientAccess {
  id: string
  userId: string
  clientId: string
  clientName: string
  organizationId: string
  permissions: {
    read: boolean
    write: boolean
  }
  grantedBy: string
  grantedAt: Date
  isActive: boolean
}

export interface Permissions {
  read: boolean
  write: boolean
}

/**
 * UserManagementService - Serviço de gerenciamento de usuários
 * Implementa CRUD completo de usuários conforme Requirements 2.1, 2.2, 2.3, 2.4, 10.1
 */
export class UserManagementService {
  private supabase: any
  private accessControl: UserAccessControlService
  private auditService: UserAccessAuditService

  constructor() {
    this.supabase = null // Will be initialized asynchronously
    this.accessControl = new UserAccessControlService()
    this.auditService = new UserAccessAuditService()
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
   * Cria um novo usuário com validação de organização e limites
   * Requirements: 2.1, 2.2, 10.1
   */
  async createUser(
    adminUserId: string,
    userData: CreateUserData,
    context?: AuditContext
  ): Promise<User> {
    const supabase = await this.initSupabase()
    
    try {
      // Verificar se o admin tem permissão para criar usuários
      const adminUserType = await this.accessControl.getUserType(adminUserId)
      
      if (adminUserType === UserType.COMMON_USER) {
        // Log access denied
        await this.auditService.logAccessDenied(
          adminUserId,
          'users',
          'create',
          'Usuários comuns não podem criar outros usuários',
          userData.organizationId,
          undefined,
          context
        )
        throw new Error('Usuários comuns não podem criar outros usuários')
      }

      // Para org admins, validar organização e limites
      if (adminUserType === UserType.ORG_ADMIN) {
        if (!userData.organizationId) {
          await this.auditService.logAccessDenied(
            adminUserId,
            'users',
            'create',
            'Organization ID é obrigatório para admins de organização',
            undefined,
            undefined,
            context
          )
          throw new Error('Organization ID é obrigatório para admins de organização')
        }

        // Verificar se o admin pertence à organização
        const isOrgAdmin = await this.accessControl.isOrgAdmin(adminUserId, userData.organizationId)
        if (!isOrgAdmin) {
          await this.auditService.logAccessDenied(
            adminUserId,
            'users',
            'create',
            'Você não tem permissão para criar usuários nesta organização',
            userData.organizationId,
            undefined,
            context
          )
          throw new Error('Você não tem permissão para criar usuários nesta organização')
        }

        // Validar limites do plano
        const limitValidation = await this.accessControl.validateActionAgainstLimits(
          userData.organizationId,
          'create_user'
        )
        
        if (!limitValidation.valid) {
          // Log plan limit exceeded
          await this.auditService.logPlanLimitExceeded(
            adminUserId,
            userData.organizationId,
            'users',
            limitValidation.currentUsage || 0,
            limitValidation.limit || 0,
            context
          )
          throw new Error(limitValidation.reason || 'Limite de usuários atingido')
        }
      }

      // Validar se a organização existe e está ativa (Requirements 10.1)
      if (userData.organizationId) {
        const { data: organization, error: orgError } = await supabase
          .from('organizations')
          .select('id, name, is_active')
          .eq('id', userData.organizationId)
          .eq('is_active', true)
          .single()

        if (orgError || !organization) {
          await this.auditService.logAccessDenied(
            adminUserId,
            'users',
            'create',
            'Organização não encontrada ou inativa',
            userData.organizationId,
            undefined,
            context
          )
          throw new Error('Organização não encontrada ou inativa')
        }
      }

      // Para super admins, se não especificaram org, usar a primeira disponível
      if (adminUserType === UserType.SUPER_ADMIN && !userData.organizationId) {
        const { data: orgs, error: orgsError } = await supabase
          .from('organizations')
          .select('id')
          .eq('is_active', true)
          .limit(1)

        if (!orgsError && orgs && orgs.length > 0) {
          userData.organizationId = orgs[0].id
        } else {
          throw new Error('Nenhuma organização ativa encontrada')
        }
      }

      // Criar usuário no Supabase Auth
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: userData.email,
        email_confirm: true,
        user_metadata: {
          name: userData.name
        }
      })

      if (authError || !authUser.user) {
        throw new Error(`Erro ao criar usuário: ${authError?.message}`)
      }

      // Criar membership na organização (Requirements 2.2)
      const { data: membership, error: membershipError } = await supabase
        .from('memberships')
        .insert({
          user_id: authUser.user.id,
          organization_id: userData.organizationId,
          role: userData.role,
          created_by: adminUserId
        })
        .select()
        .single()

      if (membershipError) {
        // Rollback: deletar usuário criado
        await supabase.auth.admin.deleteUser(authUser.user.id)
        throw new Error(`Erro ao criar membership: ${membershipError.message}`)
      }

      // Retornar dados do usuário criado
      const newUser = await this.getUserById(authUser.user.id)

      // Log successful user creation
      await this.auditService.logUserCreate(
        adminUserId,
        authUser.user.id,
        userData.organizationId!,
        userData.role,
        {
          email: userData.email,
          name: userData.name,
          role: userData.role
        },
        context
      )

      // Invalidate cache after user creation
      await UserAccessCacheInvalidator.afterUserCreation(authUser.user.id, userData.organizationId!)

      return newUser

    } catch (error) {
      console.error('Erro ao criar usuário:', error)
      throw error
    }
  }

  /**
   * Atualiza informações de um usuário com verificação de permissões
   * Requirements: 2.3
   */
  async updateUser(
    adminUserId: string,
    userId: string,
    updates: UpdateUserData,
    context?: AuditContext
  ): Promise<User> {
    const supabase = await this.initSupabase()
    
    try {
      // Get current user data for audit logging
      const currentUser = await this.getUserById(userId)
      const oldData = {
        name: currentUser.name,
        role: currentUser.organizations[0]?.role,
        isActive: currentUser.isActive
      }

      // Verificar permissões do admin
      const adminUserType = await this.accessControl.getUserType(adminUserId)
      
      if (adminUserType === UserType.COMMON_USER) {
        await this.auditService.logAccessDenied(
          adminUserId,
          'users',
          'update',
          'Usuários comuns não podem atualizar outros usuários',
          currentUser.organizations[0]?.id,
          undefined,
          context
        )
        throw new Error('Usuários comuns não podem atualizar outros usuários')
      }

      // Para org admins, verificar se o usuário pertence à mesma organização
      if (adminUserType === UserType.ORG_ADMIN) {
        const canManage = await this.canAdminManageUser(adminUserId, userId)
        if (!canManage) {
          await this.auditService.logAccessDenied(
            adminUserId,
            'users',
            'update',
            'Você não tem permissão para gerenciar este usuário',
            currentUser.organizations[0]?.id,
            undefined,
            context
          )
          throw new Error('Você não tem permissão para gerenciar este usuário')
        }
      }

      // Atualizar metadados do usuário no Auth se nome foi alterado
      if (updates.name) {
        const { error: authError } = await supabase.auth.admin.updateUserById(
          userId,
          {
            user_metadata: { name: updates.name }
          }
        )

        if (authError) {
          throw new Error(`Erro ao atualizar nome: ${authError.message}`)
        }
      }

      // Atualizar role na membership se especificado
      if (updates.role) {
        const { error: membershipError } = await supabase
          .from('memberships')
          .update({ 
            role: updates.role,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)

        if (membershipError) {
          throw new Error(`Erro ao atualizar role: ${membershipError.message}`)
        }
      }

      // Retornar dados atualizados
      const updatedUser = await this.getUserById(userId)

      // Log successful user update
      const newData = {
        name: updatedUser.name,
        role: updatedUser.organizations[0]?.role,
        isActive: updatedUser.isActive
      }

      await this.auditService.logUserUpdate(
        adminUserId,
        userId,
        currentUser.organizations[0]?.id || '',
        oldData,
        newData,
        context
      )

      // Invalidate cache after role change if role was updated
      if (updates.role) {
        // Get user's organization to invalidate properly
        const { data: membership } = await supabase
          .from('memberships')
          .select('organization_id')
          .eq('user_id', userId)
          .single()

        if (membership) {
          await UserAccessCacheInvalidator.afterRoleChange(userId, membership.organization_id)
        }
      }

      return updatedUser

    } catch (error) {
      console.error('Erro ao atualizar usuário:', error)
      throw error
    }
  }

  /**
   * Deleta um usuário com cascade de registros relacionados
   * Requirements: 2.4, 3.5
   */
  async deleteUser(
    adminUserId: string,
    userId: string,
    context?: AuditContext
  ): Promise<void> {
    const supabase = await this.initSupabase()
    
    try {
      // Get user data before deletion for audit logging
      const userToDelete = await this.getUserById(userId)
      const userData = {
        email: userToDelete.email,
        name: userToDelete.name,
        userType: userToDelete.userType,
        organizations: userToDelete.organizations
      }

      // Verificar permissões do admin
      const adminUserType = await this.accessControl.getUserType(adminUserId)
      
      if (adminUserType === UserType.COMMON_USER) {
        await this.auditService.logAccessDenied(
          adminUserId,
          'users',
          'delete',
          'Usuários comuns não podem deletar outros usuários',
          userToDelete.organizations[0]?.id,
          undefined,
          context
        )
        throw new Error('Usuários comuns não podem deletar outros usuários')
      }

      // Para org admins, verificar se o usuário pertence à mesma organização
      if (adminUserType === UserType.ORG_ADMIN) {
        const canManage = await this.canAdminManageUser(adminUserId, userId)
        if (!canManage) {
          await this.auditService.logAccessDenied(
            adminUserId,
            'users',
            'delete',
            'Você não tem permissão para deletar este usuário',
            userToDelete.organizations[0]?.id,
            undefined,
            context
          )
          throw new Error('Você não tem permissão para deletar este usuário')
        }
      }

      // Não permitir que usuário delete a si mesmo
      if (adminUserId === userId) {
        await this.auditService.logAccessDenied(
          adminUserId,
          'users',
          'delete',
          'Você não pode deletar sua própria conta',
          userToDelete.organizations[0]?.id,
          undefined,
          context
        )
        throw new Error('Você não pode deletar sua própria conta')
      }

      // Verificar se o usuário não é super admin (apenas outros super admins podem deletar)
      const targetUserType = await this.accessControl.getUserType(userId)
      if (targetUserType === UserType.SUPER_ADMIN && adminUserType !== UserType.SUPER_ADMIN) {
        await this.auditService.logAccessDenied(
          adminUserId,
          'users',
          'delete',
          'Apenas super admins podem deletar outros super admins',
          userToDelete.organizations[0]?.id,
          undefined,
          context
        )
        throw new Error('Apenas super admins podem deletar outros super admins')
      }

      // Get user's organization before deletion for cache invalidation
      const { data: membership } = await supabase
        .from('memberships')
        .select('organization_id')
        .eq('user_id', userId)
        .single()

      const orgId = membership?.organization_id

      // Deletar registros relacionados primeiro (cascade cleanup - Requirements 2.4, 3.5)
      
      // 1. Deletar acessos a clientes
      await supabase
        .from('user_client_access')
        .delete()
        .eq('user_id', userId)

      // 2. Deletar memberships
      await supabase
        .from('memberships')
        .delete()
        .eq('user_id', userId)

      // 3. Remover de super_admins se aplicável
      if (targetUserType === UserType.SUPER_ADMIN) {
        await supabase
          .from('super_admins')
          .delete()
          .eq('user_id', userId)
      }

      // 4. Deletar usuário do Auth (isso também remove referências FK)
      const { error: authError } = await supabase.auth.admin.deleteUser(userId)
      
      if (authError) {
        throw new Error(`Erro ao deletar usuário: ${authError.message}`)
      }

      // Log successful user deletion
      await this.auditService.logUserDelete(
        adminUserId,
        userId,
        orgId || '',
        userData,
        context
      )

      // Invalidate cache after user deletion
      if (orgId) {
        await UserAccessCacheInvalidator.afterUserDeletion(userId, orgId)
      }

    } catch (error) {
      console.error('Erro ao deletar usuário:', error)
      throw error
    }
  }

  /**
   * Lista usuários de uma organização com filtro
   * Requirements: 2.1
   */
  async listOrganizationUsers(
    adminUserId: string,
    orgId: string
  ): Promise<User[]> {
    const supabase = await this.initSupabase()
    
    try {
      // Verificar permissões do admin
      const adminUserType = await this.accessControl.getUserType(adminUserId)
      
      if (adminUserType === UserType.COMMON_USER) {
        throw new Error('Usuários comuns não podem listar outros usuários')
      }

      // Para org admins, verificar se pertence à organização
      if (adminUserType === UserType.ORG_ADMIN) {
        const isOrgAdmin = await this.accessControl.isOrgAdmin(adminUserId, orgId)
        if (!isOrgAdmin) {
          throw new Error('Você não tem permissão para listar usuários desta organização')
        }
      }

      // Buscar usuários da organização
      const { data: memberships, error } = await supabase
        .from('memberships')
        .select(`
          user_id,
          role,
          created_at,
          updated_at,
          organizations!inner (
            id,
            name
          )
        `)
        .eq('organization_id', orgId)

      if (error) {
        throw new Error(`Erro ao buscar usuários: ${error.message}`)
      }

      // Buscar dados dos usuários do Auth
      const userIds = memberships.map(m => m.user_id)
      const users: User[] = []

      for (const userId of userIds) {
        try {
          const user = await this.getUserById(userId)
          users.push(user)
        } catch (error) {
          console.warn(`Erro ao buscar usuário ${userId}:`, error)
          // Continuar com outros usuários
        }
      }

      return users

    } catch (error) {
      console.error('Erro ao listar usuários da organização:', error)
      throw error
    }
  }

  /**
   * Concede acesso de um usuário a um cliente
   * Requirements: 3.1, 10.2
   */
  async grantClientAccess(
    adminUserId: string,
    userId: string,
    clientId: string,
    permissions: Permissions = { read: true, write: false },
    context?: AuditContext
  ): Promise<void> {
    const supabase = await this.initSupabase()
    
    try {
      // Verificar permissões do admin
      const adminUserType = await this.accessControl.getUserType(adminUserId)
      
      if (adminUserType === UserType.COMMON_USER) {
        await this.auditService.logAccessDenied(
          adminUserId,
          'client_access',
          'grant',
          'Usuários comuns não podem conceder acessos',
          undefined,
          clientId,
          context
        )
        throw new Error('Usuários comuns não podem conceder acessos')
      }

      // Verificar se usuário e cliente pertencem à mesma organização (Requirements 10.2)
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('org_id, name')
        .eq('id', clientId)
        .single()

      if (clientError || !client) {
        throw new Error('Cliente não encontrado')
      }

      const { data: membership, error: membershipError } = await supabase
        .from('memberships')
        .select('organization_id')
        .eq('user_id', userId)
        .single()

      if (membershipError || !membership) {
        throw new Error('Usuário não encontrado ou sem organização')
      }

      if (client.org_id !== membership.organization_id) {
        await this.auditService.logAccessDenied(
          adminUserId,
          'client_access',
          'grant',
          'Usuário e cliente devem pertencer à mesma organização',
          membership.organization_id,
          clientId,
          context
        )
        throw new Error('Usuário e cliente devem pertencer à mesma organização')
      }

      // Para org admins, verificar se pertencem à organização
      if (adminUserType === UserType.ORG_ADMIN) {
        const isOrgAdmin = await this.accessControl.isOrgAdmin(adminUserId, client.org_id)
        if (!isOrgAdmin) {
          await this.auditService.logAccessDenied(
            adminUserId,
            'client_access',
            'grant',
            'Você não tem permissão para conceder acesso nesta organização',
            client.org_id,
            clientId,
            context
          )
          throw new Error('Você não tem permissão para conceder acesso nesta organização')
        }
      }

      // Criar ou atualizar acesso
      const { error: accessError } = await supabase
        .from('user_client_access')
        .upsert({
          user_id: userId,
          client_id: clientId,
          organization_id: client.org_id,
          granted_by: adminUserId,
          permissions,
          is_active: true,
          updated_at: new Date().toISOString()
        })

      if (accessError) {
        throw new Error(`Erro ao conceder acesso: ${accessError.message}`)
      }

      // Log successful access grant
      await this.auditService.logAccessGrant(
        adminUserId,
        userId,
        clientId,
        client.org_id,
        permissions,
        context
      )

      // Invalidate cache after client access change
      await UserAccessCacheInvalidator.afterClientAccessChange(userId, clientId)

    } catch (error) {
      console.error('Erro ao conceder acesso ao cliente:', error)
      throw error
    }
  }

  /**
   * Revoga acesso de um usuário a um cliente
   * Requirements: 3.3
   */
  async revokeClientAccess(
    adminUserId: string,
    userId: string,
    clientId: string,
    context?: AuditContext
  ): Promise<void> {
    const supabase = await this.initSupabase()
    
    try {
      // Get current access data for audit logging
      const { data: currentAccess } = await supabase
        .from('user_client_access')
        .select('permissions, organization_id')
        .eq('user_id', userId)
        .eq('client_id', clientId)
        .eq('is_active', true)
        .single()

      // Verificar permissões do admin
      const adminUserType = await this.accessControl.getUserType(adminUserId)
      
      if (adminUserType === UserType.COMMON_USER) {
        await this.auditService.logAccessDenied(
          adminUserId,
          'client_access',
          'revoke',
          'Usuários comuns não podem revogar acessos',
          currentAccess?.organization_id,
          clientId,
          context
        )
        throw new Error('Usuários comuns não podem revogar acessos')
      }

      // Para org admins, verificar se o acesso pertence à sua organização
      if (adminUserType === UserType.ORG_ADMIN) {
        const { data: access, error: accessError } = await supabase
          .from('user_client_access')
          .select('organization_id')
          .eq('user_id', userId)
          .eq('client_id', clientId)
          .single()

        if (accessError || !access) {
          throw new Error('Acesso não encontrado')
        }

        const isOrgAdmin = await this.accessControl.isOrgAdmin(adminUserId, access.organization_id)
        if (!isOrgAdmin) {
          await this.auditService.logAccessDenied(
            adminUserId,
            'client_access',
            'revoke',
            'Você não tem permissão para revogar este acesso',
            access.organization_id,
            clientId,
            context
          )
          throw new Error('Você não tem permissão para revogar este acesso')
        }
      }

      // Marcar acesso como inativo (soft delete para auditoria)
      const { error } = await supabase
        .from('user_client_access')
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('client_id', clientId)

      if (error) {
        throw new Error(`Erro ao revogar acesso: ${error.message}`)
      }

      // Log successful access revocation
      await this.auditService.logAccessRevoke(
        adminUserId,
        userId,
        clientId,
        currentAccess?.organization_id || '',
        currentAccess?.permissions,
        context
      )

      // Invalidate cache after client access change
      await UserAccessCacheInvalidator.afterClientAccessChange(userId, clientId)

    } catch (error) {
      console.error('Erro ao revogar acesso ao cliente:', error)
      throw error
    }
  }

  /**
   * Lista acessos de um usuário aos clientes
   * Requirements: 3.2
   */
  async listUserClientAccess(
    adminUserId: string,
    userId: string
  ): Promise<ClientAccess[]> {
    const supabase = await this.initSupabase()
    
    try {
      // Verificar permissões do admin
      const adminUserType = await this.accessControl.getUserType(adminUserId)
      
      if (adminUserType === UserType.COMMON_USER) {
        // Usuários comuns só podem ver seus próprios acessos
        if (adminUserId !== userId) {
          throw new Error('Você só pode visualizar seus próprios acessos')
        }
      }

      // Para org admins, verificar se o usuário pertence à mesma organização
      if (adminUserType === UserType.ORG_ADMIN) {
        const canManage = await this.canAdminManageUser(adminUserId, userId)
        if (!canManage) {
          throw new Error('Você não tem permissão para visualizar acessos deste usuário')
        }
      }

      // Buscar acessos do usuário
      const { data: accesses, error } = await supabase
        .from('user_client_access')
        .select(`
          id,
          user_id,
          client_id,
          organization_id,
          permissions,
          granted_by,
          created_at,
          is_active,
          clients!inner (
            name
          )
        `)
        .eq('user_id', userId)
        .eq('is_active', true)

      if (error) {
        throw new Error(`Erro ao buscar acessos: ${error.message}`)
      }

      return accesses.map(access => ({
        id: access.id,
        userId: access.user_id,
        clientId: access.client_id,
        clientName: access.clients.name,
        organizationId: access.organization_id,
        permissions: access.permissions,
        grantedBy: access.granted_by,
        grantedAt: new Date(access.created_at),
        isActive: access.is_active
      }))

    } catch (error) {
      console.error('Erro ao listar acessos do usuário:', error)
      throw error
    }
  }

  /**
   * Métodos auxiliares privados
   */

  /**
   * Busca dados completos de um usuário por ID
   */
  private async getUserById(userId: string): Promise<User> {
    const supabase = await this.initSupabase()
    
    // Buscar dados do Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId)
    
    if (authError || !authUser.user) {
      throw new Error('Usuário não encontrado')
    }

    // Buscar organizações do usuário
    const { data: memberships, error: membershipError } = await supabase
      .from('memberships')
      .select(`
        role,
        organizations!inner (
          id,
          name
        )
      `)
      .eq('user_id', userId)

    const organizations = membershipError ? [] : memberships.map(m => ({
      id: m.organizations.id,
      name: m.organizations.name,
      role: m.role
    }))

    // Determinar tipo de usuário
    const userType = await this.accessControl.getUserType(userId)

    return {
      id: authUser.user.id,
      email: authUser.user.email || '',
      name: authUser.user.user_metadata?.name || authUser.user.email || '',
      userType,
      organizations,
      createdAt: new Date(authUser.user.created_at),
      updatedAt: new Date(authUser.user.updated_at || authUser.user.created_at),
      isActive: true // Auth users are active by default
    }
  }

  /**
   * Verifica se um admin pode gerenciar um usuário específico
   */
  private async canAdminManageUser(adminUserId: string, userId: string): Promise<boolean> {
    const supabase = await this.initSupabase()
    
    try {
      // Buscar organizações do admin
      const { data: adminMemberships, error: adminError } = await supabase
        .from('memberships')
        .select('organization_id')
        .eq('user_id', adminUserId)
        .eq('role', 'admin')

      if (adminError || !adminMemberships || adminMemberships.length === 0) {
        return false
      }

      // Buscar organizações do usuário alvo
      const { data: userMemberships, error: userError } = await supabase
        .from('memberships')
        .select('organization_id')
        .eq('user_id', userId)

      if (userError || !userMemberships || userMemberships.length === 0) {
        return false
      }

      // Verificar se há interseção nas organizações
      const adminOrgIds = adminMemberships.map(m => m.organization_id)
      const userOrgIds = userMemberships.map(m => m.organization_id)
      
      return adminOrgIds.some(orgId => userOrgIds.includes(orgId))

    } catch (error) {
      console.error('Erro ao verificar permissão de gerenciamento:', error)
      return false
    }
  }
}

// Export singleton instance
export const userManagementService = new UserManagementService()