import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { UserAccessControlService, UserType, ResourceType, Action, LimitedAction, Client, ValidationResult } from '@/lib/services/user-access-control'

export interface AccessControlOptions {
  resourceType: ResourceType
  action: Action
  requireClientId?: boolean
  allowedUserTypes?: UserType[]
  errorMessage?: string
  validatePlanLimit?: LimitedAction
}

export interface AccessControlContext {
  user: any
  userType: UserType
  userLimits?: any
  clientId?: string
  organizationId?: string
  // Métodos do access control service
  hasClientAccess?: (userId: string, clientId: string) => Promise<boolean>
  getUserAccessibleClients?: (userId: string) => Promise<Client[]>
  validateActionAgainstLimits?: (orgId: string, action: LimitedAction) => Promise<ValidationResult>
}

/**
 * Middleware base de controle de acesso
 * Implementa os requisitos 8.1, 8.2, 8.3, 8.4
 */
export function withUserAccessControl(options: AccessControlOptions) {
  return function middleware(handler: Function) {
    return async function (request: NextRequest, context?: any) {
      try {
        const supabase = await createClient()
        const accessControl = new UserAccessControlService()

        // Obter usuário atual
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        
        if (authError || !user) {
          return NextResponse.json(
            { 
              error: 'Autenticação necessária',
              code: 'UNAUTHORIZED',
              details: { authError: authError?.message }
            },
            { status: 401 }
          )
        }

        // Obter tipo de usuário
        const userType = await accessControl.getUserType(user.id)

        // Extrair clientId se necessário
        let clientId: string | undefined
        if (options.requireClientId) {
          const url = new URL(request.url)
          
          // Tentar múltiplas fontes para clientId
          clientId = 
            url.searchParams.get('clientId') ||
            url.searchParams.get('client_id') ||
            context?.params?.clientId ||
            context?.clientId

          // Para requests POST/PUT, tentar extrair do body
          if (!clientId && (request.method === 'POST' || request.method === 'PUT')) {
            try {
              const body = await request.clone().json()
              clientId = body.clientId || body.client_id
            } catch (error) {
              // Ignorar erro de parsing do body
            }
          }

          if (!clientId) {
            return NextResponse.json(
              { 
                error: 'Client ID é obrigatório para esta operação',
                code: 'CLIENT_ID_REQUIRED',
                details: { 
                  resourceType: options.resourceType,
                  action: options.action
                }
              },
              { status: 400 }
            )
          }
        }

        // Obter organização do usuário (se não for super admin)
        let organizationId: string | undefined
        if (userType !== UserType.SUPER_ADMIN) {
          const { data: membership } = await supabase
            .from('memberships')
            .select('organization_id')
            .eq('user_id', user.id)
            .single()
          
          organizationId = membership?.organization_id

          // Se não tem organização e não é super admin, negar acesso
          if (!organizationId) {
            return NextResponse.json(
              {
                error: 'Usuário não pertence a nenhuma organização',
                code: 'NO_ORGANIZATION',
                userType
              },
              { status: 403 }
            )
          }
        }

        // Verificar tipo de usuário se especificado
        if (options.allowedUserTypes && options.allowedUserTypes.length > 0) {
          if (!options.allowedUserTypes.includes(userType)) {
            return NextResponse.json(
              {
                error: options.errorMessage || `Acesso negado: tipo de usuário '${userType}' não permitido`,
                code: 'USER_TYPE_NOT_ALLOWED',
                userType,
                allowedTypes: options.allowedUserTypes,
                details: {
                  resourceType: options.resourceType,
                  action: options.action
                }
              },
              { status: 403 }
            )
          }
        }

        // Validar limites de plano se especificado
        if (options.validatePlanLimit && organizationId && userType !== UserType.SUPER_ADMIN) {
          const validation = await accessControl.validateActionAgainstLimits(
            organizationId,
            options.validatePlanLimit
          )

          if (!validation.valid) {
            return NextResponse.json(
              {
                error: validation.reason || 'Limite do plano atingido',
                code: 'PLAN_LIMIT_EXCEEDED',
                userType,
                currentUsage: validation.currentUsage,
                limit: validation.limit,
                planLimitAction: options.validatePlanLimit,
                upgradeRequired: true
              },
              { status: 402 } // Payment Required
            )
          }
        }

        // Verificar permissões específicas
        const accessResult = await accessControl.checkPermission(
          user.id,
          options.resourceType,
          options.action,
          clientId
        )

        if (!accessResult.allowed) {
          return NextResponse.json(
            {
              error: options.errorMessage || accessResult.reason || 'Acesso negado',
              code: 'ACCESS_DENIED',
              userType: accessResult.userType,
              limits: accessResult.limits,
              details: {
                resourceType: options.resourceType,
                action: options.action,
                clientId: clientId || null
              }
            },
            { status: 403 }
          )
        }

        // Adicionar informações do usuário ao contexto
        const enhancedContext: AccessControlContext = {
          ...context,
          user,
          userType: accessResult.userType,
          userLimits: accessResult.limits,
          clientId,
          organizationId,
          // Adicionar métodos do access control service
          hasClientAccess: (userId: string, clientId: string) => accessControl.hasClientAccess(userId, clientId),
          getUserAccessibleClients: (userId: string) => accessControl.getUserAccessibleClients(userId),
          validateActionAgainstLimits: (orgId: string, action: LimitedAction) => 
            accessControl.validateActionAgainstLimits(orgId, action)
        }

        // Chamar o handler original
        return await handler(request, enhancedContext)

      } catch (error) {
        console.error('Erro no middleware de controle de acesso:', error)
        return NextResponse.json(
          { 
            error: 'Erro interno do servidor',
            code: 'INTERNAL_ERROR',
            details: error instanceof Error ? error.message : 'Unknown error'
          },
          { status: 500 }
        )
      }
    }
  }
}

/**
 * Helper específico: Requer Super Admin
 * Requirements: 1.1, 1.2, 1.3, 1.5
 */
export function requireSuperAdmin(errorMessage?: string) {
  return withUserAccessControl({
    resourceType: 'users',
    action: 'read',
    allowedUserTypes: [UserType.SUPER_ADMIN],
    errorMessage: errorMessage || 'Acesso restrito a Super Admins'
  })
}

/**
 * Helper específico: Requer Admin de Organização ou Super Admin
 * Requirements: 2.1, 2.3, 2.5
 */
export function requireOrgAdmin(errorMessage?: string) {
  return withUserAccessControl({
    resourceType: 'users',
    action: 'read',
    allowedUserTypes: [UserType.SUPER_ADMIN, UserType.ORG_ADMIN],
    errorMessage: errorMessage || 'Acesso restrito a Admins de Organização'
  })
}

/**
 * Helper específico: Requer qualquer tipo de admin (Super Admin ou Org Admin)
 * Requirements: 2.1, 2.3, 2.5, 1.1, 1.2, 1.3
 */
export function requireAnyAdmin(errorMessage?: string) {
  return withUserAccessControl({
    resourceType: 'users',
    action: 'read',
    allowedUserTypes: [UserType.SUPER_ADMIN, UserType.ORG_ADMIN],
    errorMessage: errorMessage || 'Acesso restrito a Administradores'
  })
}

/**
 * Helper específico: Requer acesso a cliente
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */
export function requireClientAccess(errorMessage?: string) {
  return withUserAccessControl({
    resourceType: 'campaigns',
    action: 'read',
    requireClientId: true,
    errorMessage: errorMessage || 'Acesso negado: você não tem permissão para acessar este cliente'
  })
}

/**
 * Helper específico: Validar limite de plano
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */
export function validatePlanLimit(action: LimitedAction, errorMessage?: string) {
  return withUserAccessControl({
    resourceType: 'users',
    action: 'create',
    validatePlanLimit: action,
    errorMessage: errorMessage || 'Limite do plano atingido'
  })
}

/**
 * Funções helper para criar middlewares específicos
 */
export const createAccessControl = {
  /**
   * Middleware para operações de leitura de campanhas
   */
  readCampaigns: (requireClientId = true, errorMessage?: string) =>
    withUserAccessControl({
      resourceType: 'campaigns',
      action: 'read',
      requireClientId,
      errorMessage: errorMessage || 'Acesso negado para visualizar campanhas'
    }),

  /**
   * Middleware para operações de escrita de campanhas
   */
  writeCampaigns: (requireClientId = true, errorMessage?: string) =>
    withUserAccessControl({
      resourceType: 'campaigns',
      action: 'create',
      requireClientId,
      allowedUserTypes: [UserType.SUPER_ADMIN, UserType.ORG_ADMIN], // Common users não podem escrever
      errorMessage: errorMessage || 'Acesso negado para modificar campanhas'
    }),

  /**
   * Middleware para leitura de relatórios
   */
  readReports: (requireClientId = true, errorMessage?: string) =>
    withUserAccessControl({
      resourceType: 'reports',
      action: 'read',
      requireClientId,
      errorMessage: errorMessage || 'Acesso negado para visualizar relatórios'
    }),

  /**
   * Middleware para criação de usuários com validação de limite
   */
  createUser: (errorMessage?: string) =>
    withUserAccessControl({
      resourceType: 'users',
      action: 'create',
      allowedUserTypes: [UserType.SUPER_ADMIN, UserType.ORG_ADMIN],
      validatePlanLimit: 'create_user',
      errorMessage: errorMessage || 'Acesso negado para criar usuários'
    }),

  /**
   * Middleware para criação de clientes com validação de limite
   */
  createClient: (errorMessage?: string) =>
    withUserAccessControl({
      resourceType: 'clients',
      action: 'create',
      allowedUserTypes: [UserType.SUPER_ADMIN, UserType.ORG_ADMIN],
      validatePlanLimit: 'create_client',
      errorMessage: errorMessage || 'Acesso negado para criar clientes'
    }),

  /**
   * Middleware para criação de conexões com validação de limite
   */
  createConnection: (errorMessage?: string) =>
    withUserAccessControl({
      resourceType: 'connections',
      action: 'create',
      allowedUserTypes: [UserType.SUPER_ADMIN, UserType.ORG_ADMIN],
      validatePlanLimit: 'create_connection',
      errorMessage: errorMessage || 'Acesso negado para criar conexões'
    }),

  /**
   * Middleware para gerenciamento de usuários (CRUD completo)
   */
  manageUsers: (errorMessage?: string) =>
    withUserAccessControl({
      resourceType: 'users',
      action: 'update',
      allowedUserTypes: [UserType.SUPER_ADMIN, UserType.ORG_ADMIN],
      errorMessage: errorMessage || 'Acesso negado para gerenciar usuários'
    }),

  /**
   * Middleware para gerenciamento de acesso a clientes
   */
  manageClientAccess: (errorMessage?: string) =>
    withUserAccessControl({
      resourceType: 'clients',
      action: 'update',
      allowedUserTypes: [UserType.SUPER_ADMIN, UserType.ORG_ADMIN],
      errorMessage: errorMessage || 'Acesso negado para gerenciar acesso a clientes'
    }),

  /**
   * Middleware para operações que requerem organização membership
   */
  requireOrganizationMembership: (errorMessage?: string) =>
    withUserAccessControl({
      resourceType: 'users',
      action: 'read',
      allowedUserTypes: [UserType.SUPER_ADMIN, UserType.ORG_ADMIN, UserType.COMMON_USER],
      errorMessage: errorMessage || 'Acesso negado: membership de organização necessário'
    }),

  /**
   * Middleware customizado com opções específicas
   */
  custom: (options: AccessControlOptions) =>
    withUserAccessControl(options)
}

/**
 * Função para extrair informações do usuário do contexto
 */
export function getUserFromAccessContext(context: AccessControlContext): {
  user: any
  userType: UserType
  userLimits: any
  clientId?: string
  organizationId?: string
} | null {
  if (!context?.user) return null

  return {
    user: context.user,
    userType: context.userType,
    userLimits: context.userLimits,
    clientId: context.clientId,
    organizationId: context.organizationId
  }
}

/**
 * Função para verificar se o usuário no contexto é super admin
 */
export function isSuperAdminInContext(context: AccessControlContext): boolean {
  return context?.userType === UserType.SUPER_ADMIN
}

/**
 * Função para verificar se o usuário no contexto é admin de organização
 */
export function isOrgAdminInContext(context: AccessControlContext): boolean {
  return context?.userType === UserType.ORG_ADMIN
}

/**
 * Função para verificar se o usuário no contexto é usuário comum
 */
export function isCommonUserInContext(context: AccessControlContext): boolean {
  return context?.userType === UserType.COMMON_USER
}

/**
 * Função para obter limites do usuário do contexto
 */
export function getUserLimitsFromContext(context: AccessControlContext): any | null {
  return context?.userLimits || null
}

/**
 * Função para obter organização do usuário do contexto
 */
export function getOrganizationFromContext(context: AccessControlContext): string | null {
  return context?.organizationId || null
}

/**
 * Função para validar se o usuário pode acessar uma organização específica
 */
export async function validateOrganizationAccess(
  userId: string, 
  organizationId: string, 
  userType: UserType
): Promise<boolean> {
  if (userType === UserType.SUPER_ADMIN) {
    return true // Super admins podem acessar qualquer organização
  }

  const supabase = await createClient()
  
  try {
    const { data: membership, error } = await supabase
      .from('memberships')
      .select('id')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .single()

    return !error && !!membership
  } catch (error) {
    console.error('Erro ao validar acesso à organização:', error)
    return false
  }
}

/**
 * Função para extrair clientId de diferentes fontes na requisição
 */
export function extractClientId(request: NextRequest, context?: any): string | null {
  const url = new URL(request.url)
  
  // Tentar múltiplas fontes
  return (
    url.searchParams.get('clientId') ||
    url.searchParams.get('client_id') ||
    context?.params?.clientId ||
    context?.clientId ||
    null
  )
}

/**
 * Função para extrair organizationId de diferentes fontes na requisição
 */
export function extractOrganizationId(request: NextRequest, context?: any): string | null {
  const url = new URL(request.url)
  
  return (
    url.searchParams.get('organizationId') ||
    url.searchParams.get('organization_id') ||
    url.searchParams.get('orgId') ||
    url.searchParams.get('org_id') ||
    context?.params?.organizationId ||
    context?.organizationId ||
    null
  )
}

/**
 * Função para criar resposta de erro padronizada
 */
export function createAccessDeniedResponse(
  message: string,
  code: string,
  userType: UserType,
  details?: any
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      code,
      userType,
      details: details || null,
      timestamp: new Date().toISOString()
    },
    { status: 403 }
  )
}

/**
 * Função para criar resposta de limite de plano atingido
 */
export function createPlanLimitResponse(
  message: string,
  currentUsage: number,
  limit: number,
  action: LimitedAction,
  userType: UserType
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      code: 'PLAN_LIMIT_EXCEEDED',
      userType,
      currentUsage,
      limit,
      action,
      upgradeRequired: true,
      timestamp: new Date().toISOString()
    },
    { status: 402 }
  )
}

/**
 * Função para verificar se uma requisição tem bypass de super admin
 */
export function hasSuperAdminBypass(request: NextRequest): boolean {
  return request.headers.get('X-Super-Admin') === 'true'
}

/**
 * Função para adicionar headers de contexto à resposta
 */
export function addContextHeaders(response: NextResponse, context: AccessControlContext): NextResponse {
  if (context.userType) {
    response.headers.set('X-User-Type', context.userType)
  }
  
  if (context.organizationId) {
    response.headers.set('X-Organization-Id', context.organizationId)
  }
  
  if (context.clientId) {
    response.headers.set('X-Client-Id', context.clientId)
  }
  
  return response
}