import { UserType, LimitedAction } from '@/lib/services/user-access-control'

/**
 * Tipos de erro específicos do sistema de controle de acesso
 * Baseado nos requisitos 6.1, 9.4, 9.5
 */
export enum AccessControlErrorCode {
  // Authentication errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  
  // Authorization errors
  FORBIDDEN = 'FORBIDDEN',
  USER_TYPE_NOT_ALLOWED = 'USER_TYPE_NOT_ALLOWED',
  ACCESS_DENIED = 'ACCESS_DENIED',
  CLIENT_ACCESS_DENIED = 'CLIENT_ACCESS_DENIED',
  
  // Plan limit errors
  PLAN_LIMIT_EXCEEDED = 'PLAN_LIMIT_EXCEEDED',
  SUBSCRIPTION_EXPIRED = 'SUBSCRIPTION_EXPIRED',
  SUBSCRIPTION_INACTIVE = 'SUBSCRIPTION_INACTIVE',
  
  // Validation errors
  CLIENT_ID_REQUIRED = 'CLIENT_ID_REQUIRED',
  INVALID_ORGANIZATION = 'INVALID_ORGANIZATION',
  NO_ORGANIZATION = 'NO_ORGANIZATION',
  SAME_ORG_VIOLATION = 'SAME_ORG_VIOLATION',
  DUPLICATE_MEMBERSHIP = 'DUPLICATE_MEMBERSHIP',
  
  // System errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE'
}

export interface AccessControlErrorDetails {
  userType?: UserType
  requiredPermission?: string
  currentUsage?: number
  limit?: number
  planLimitAction?: LimitedAction
  allowedTypes?: UserType[]
  resourceType?: string
  action?: string
  clientId?: string
  organizationId?: string
  upgradeRequired?: boolean
}

export interface AccessControlError {
  code: AccessControlErrorCode
  message: string
  userMessage: string
  details?: AccessControlErrorDetails
  recoverable: boolean
  actions: AccessControlErrorAction[]
  severity: 'low' | 'medium' | 'high' | 'critical'
}

export interface AccessControlErrorAction {
  type: 'retry' | 'upgrade' | 'contact' | 'login' | 'back' | 'redirect' | 'request_access'
  label: string
  primary?: boolean
  url?: string
  handler?: () => void | Promise<void>
}

/**
 * Handler de erros específico para controle de acesso
 * Converte erros de API em objetos AccessControlError estruturados
 */
export class AccessControlErrorHandler {
  private static errorMap: Record<AccessControlErrorCode, Partial<AccessControlError>> = {
    // Authentication Errors
    [AccessControlErrorCode.UNAUTHORIZED]: {
      userMessage: 'Você precisa fazer login para acessar esta funcionalidade',
      recoverable: true,
      severity: 'medium',
      actions: [
        { type: 'login', label: 'Fazer Login', primary: true },
        { type: 'back', label: 'Voltar' }
      ]
    },
    
    [AccessControlErrorCode.TOKEN_EXPIRED]: {
      userMessage: 'Sua sessão expirou. Faça login novamente',
      recoverable: true,
      severity: 'medium',
      actions: [
        { type: 'login', label: 'Fazer Login Novamente', primary: true }
      ]
    },

    // Authorization Errors
    [AccessControlErrorCode.FORBIDDEN]: {
      userMessage: 'Você não tem permissão para realizar esta ação',
      recoverable: false,
      severity: 'high',
      actions: [
        { type: 'back', label: 'Voltar', primary: true },
        { type: 'contact', label: 'Solicitar Acesso' }
      ]
    },

    [AccessControlErrorCode.USER_TYPE_NOT_ALLOWED]: {
      userMessage: 'Seu tipo de usuário não tem permissão para esta funcionalidade',
      recoverable: false,
      severity: 'high',
      actions: [
        { type: 'back', label: 'Voltar', primary: true },
        { type: 'contact', label: 'Solicitar Permissão' }
      ]
    },

    [AccessControlErrorCode.ACCESS_DENIED]: {
      userMessage: 'Acesso negado para este recurso',
      recoverable: false,
      severity: 'high',
      actions: [
        { type: 'back', label: 'Voltar', primary: true },
        { type: 'request_access', label: 'Solicitar Acesso' }
      ]
    },

    [AccessControlErrorCode.CLIENT_ACCESS_DENIED]: {
      userMessage: 'Você não tem acesso a este cliente',
      recoverable: false,
      severity: 'high',
      actions: [
        { type: 'back', label: 'Voltar', primary: true },
        { type: 'request_access', label: 'Solicitar Acesso ao Cliente' }
      ]
    },

    // Plan Limit Errors
    [AccessControlErrorCode.PLAN_LIMIT_EXCEEDED]: {
      userMessage: 'Limite do seu plano foi atingido',
      recoverable: true,
      severity: 'medium',
      actions: [
        { type: 'upgrade', label: 'Fazer Upgrade', primary: true },
        { type: 'back', label: 'Voltar' },
        { type: 'contact', label: 'Falar com Vendas' }
      ]
    },

    [AccessControlErrorCode.SUBSCRIPTION_EXPIRED]: {
      userMessage: 'Sua assinatura expirou. Renove para continuar criando recursos',
      recoverable: true,
      severity: 'high',
      actions: [
        { type: 'upgrade', label: 'Renovar Assinatura', primary: true },
        { type: 'contact', label: 'Falar com Suporte' }
      ]
    },

    [AccessControlErrorCode.SUBSCRIPTION_INACTIVE]: {
      userMessage: 'Sua assinatura está inativa. Ative para continuar',
      recoverable: true,
      severity: 'high',
      actions: [
        { type: 'upgrade', label: 'Ativar Assinatura', primary: true },
        { type: 'contact', label: 'Falar com Suporte' }
      ]
    },

    // Validation Errors
    [AccessControlErrorCode.CLIENT_ID_REQUIRED]: {
      userMessage: 'É necessário selecionar um cliente para esta operação',
      recoverable: true,
      severity: 'low',
      actions: [
        { type: 'back', label: 'Selecionar Cliente', primary: true }
      ]
    },

    [AccessControlErrorCode.INVALID_ORGANIZATION]: {
      userMessage: 'Organização inválida ou inativa',
      recoverable: false,
      severity: 'high',
      actions: [
        { type: 'contact', label: 'Contatar Suporte', primary: true }
      ]
    },

    [AccessControlErrorCode.NO_ORGANIZATION]: {
      userMessage: 'Você não pertence a nenhuma organização',
      recoverable: false,
      severity: 'critical',
      actions: [
        { type: 'contact', label: 'Contatar Suporte', primary: true }
      ]
    },

    [AccessControlErrorCode.SAME_ORG_VIOLATION]: {
      userMessage: 'Usuário e cliente devem pertencer à mesma organização',
      recoverable: false,
      severity: 'medium',
      actions: [
        { type: 'back', label: 'Voltar', primary: true }
      ]
    },

    [AccessControlErrorCode.DUPLICATE_MEMBERSHIP]: {
      userMessage: 'Este usuário já pertence a esta organização',
      recoverable: false,
      severity: 'low',
      actions: [
        { type: 'back', label: 'Voltar', primary: true }
      ]
    },

    // System Errors
    [AccessControlErrorCode.INTERNAL_ERROR]: {
      userMessage: 'Erro interno do sistema. Nossa equipe foi notificada',
      recoverable: true,
      severity: 'critical',
      actions: [
        { type: 'retry', label: 'Tentar Novamente', primary: true },
        { type: 'contact', label: 'Reportar Problema' }
      ]
    },

    [AccessControlErrorCode.SERVICE_UNAVAILABLE]: {
      userMessage: 'Serviço temporariamente indisponível',
      recoverable: true,
      severity: 'high',
      actions: [
        { type: 'retry', label: 'Tentar Novamente', primary: true },
        { type: 'contact', label: 'Reportar Problema' }
      ]
    }
  }

  /**
   * Converte um erro de API em AccessControlError estruturado
   */
  static handleError(error: any): AccessControlError {
    let errorCode: AccessControlErrorCode = AccessControlErrorCode.INTERNAL_ERROR
    let message = 'Erro desconhecido'
    let details: AccessControlErrorDetails = {}

    // Extrair informações do erro
    if (error?.response) {
      // Erro HTTP
      const status = error.response.status
      const data = error.response.data

      if (status === 401) {
        errorCode = data?.code === 'TOKEN_EXPIRED' 
          ? AccessControlErrorCode.TOKEN_EXPIRED 
          : AccessControlErrorCode.UNAUTHORIZED
      } else if (status === 403) {
        errorCode = this.mapForbiddenError(data?.code)
      } else if (status === 402) {
        errorCode = AccessControlErrorCode.PLAN_LIMIT_EXCEEDED
      } else if (status === 400) {
        errorCode = this.mapValidationError(data?.code)
      } else if (status >= 500) {
        errorCode = AccessControlErrorCode.SERVICE_UNAVAILABLE
      }

      message = data?.error || data?.message || message
      details = data?.details || {}
    } else if (error?.code) {
      // Erro com código específico
      errorCode = this.mapErrorCode(error.code)
      message = error.message || message
      details = error.details || {}
    } else if (error?.message) {
      message = error.message
      errorCode = this.inferErrorCode(message)
    }

    // Obter configuração do erro
    const errorConfig = this.errorMap[errorCode] || {}

    const accessControlError: AccessControlError = {
      code: errorCode,
      message,
      userMessage: errorConfig.userMessage || message,
      details,
      recoverable: errorConfig.recoverable ?? true,
      actions: errorConfig.actions || [
        { type: 'retry', label: 'Tentar Novamente', primary: true },
        { type: 'contact', label: 'Contatar Suporte' }
      ],
      severity: errorConfig.severity || 'medium'
    }

    // Personalizar ações baseado nos detalhes
    this.customizeActions(accessControlError)

    // Log do erro para monitoramento
    this.logError(accessControlError, error)

    return accessControlError
  }

  /**
   * Mapeia códigos de erro 403 (Forbidden)
   */
  private static mapForbiddenError(code?: string): AccessControlErrorCode {
    switch (code) {
      case 'USER_TYPE_NOT_ALLOWED':
        return AccessControlErrorCode.USER_TYPE_NOT_ALLOWED
      case 'CLIENT_ACCESS_DENIED':
        return AccessControlErrorCode.CLIENT_ACCESS_DENIED
      case 'ACCESS_DENIED':
        return AccessControlErrorCode.ACCESS_DENIED
      default:
        return AccessControlErrorCode.FORBIDDEN
    }
  }

  /**
   * Mapeia códigos de erro 400 (Bad Request)
   */
  private static mapValidationError(code?: string): AccessControlErrorCode {
    switch (code) {
      case 'CLIENT_ID_REQUIRED':
        return AccessControlErrorCode.CLIENT_ID_REQUIRED
      case 'INVALID_ORGANIZATION':
        return AccessControlErrorCode.INVALID_ORGANIZATION
      case 'NO_ORGANIZATION':
        return AccessControlErrorCode.NO_ORGANIZATION
      case 'SAME_ORG_VIOLATION':
        return AccessControlErrorCode.SAME_ORG_VIOLATION
      case 'DUPLICATE_MEMBERSHIP':
        return AccessControlErrorCode.DUPLICATE_MEMBERSHIP
      default:
        return AccessControlErrorCode.INTERNAL_ERROR
    }
  }

  /**
   * Mapeia códigos de erro genéricos
   */
  private static mapErrorCode(code: string): AccessControlErrorCode {
    const upperCode = code.toUpperCase()
    
    if (Object.values(AccessControlErrorCode).includes(upperCode as AccessControlErrorCode)) {
      return upperCode as AccessControlErrorCode
    }

    return AccessControlErrorCode.INTERNAL_ERROR
  }

  /**
   * Infere código de erro baseado na mensagem
   */
  private static inferErrorCode(message: string): AccessControlErrorCode {
    const lowerMessage = message.toLowerCase()

    if (lowerMessage.includes('unauthorized') || lowerMessage.includes('não autorizado')) {
      return AccessControlErrorCode.UNAUTHORIZED
    }
    if (lowerMessage.includes('forbidden') || lowerMessage.includes('acesso negado')) {
      return AccessControlErrorCode.FORBIDDEN
    }
    if (lowerMessage.includes('limit') || lowerMessage.includes('limite')) {
      return AccessControlErrorCode.PLAN_LIMIT_EXCEEDED
    }
    if (lowerMessage.includes('expired') || lowerMessage.includes('expirado')) {
      return AccessControlErrorCode.SUBSCRIPTION_EXPIRED
    }
    if (lowerMessage.includes('client') && lowerMessage.includes('access')) {
      return AccessControlErrorCode.CLIENT_ACCESS_DENIED
    }

    return AccessControlErrorCode.INTERNAL_ERROR
  }

  /**
   * Personaliza ações baseado nos detalhes do erro
   */
  private static customizeActions(error: AccessControlError): void {
    const { details } = error

    // Adicionar informações específicas às ações
    if (error.code === AccessControlErrorCode.PLAN_LIMIT_EXCEEDED && details?.upgradeRequired) {
      const upgradeAction = error.actions.find(a => a.type === 'upgrade')
      if (upgradeAction && details.planLimitAction) {
        const actionLabels = {
          create_user: 'Upgrade para Mais Usuários',
          create_client: 'Upgrade para Mais Clientes',
          create_connection: 'Upgrade para Mais Conexões',
          create_campaign: 'Upgrade para Mais Campanhas'
        }
        upgradeAction.label = actionLabels[details.planLimitAction] || upgradeAction.label
      }
    }

    // Adicionar URL de upgrade se necessário
    if (error.actions.some(a => a.type === 'upgrade')) {
      const upgradeAction = error.actions.find(a => a.type === 'upgrade')
      if (upgradeAction) {
        upgradeAction.url = '/dashboard/billing/upgrade'
      }
    }

    // Adicionar handler para solicitar acesso
    if (error.actions.some(a => a.type === 'request_access')) {
      const requestAction = error.actions.find(a => a.type === 'request_access')
      if (requestAction) {
        requestAction.handler = () => {
          // Implementar lógica de solicitação de acesso
          console.log('Solicitar acesso:', details)
        }
      }
    }
  }

  /**
   * Log do erro para monitoramento
   */
  private static async logError(accessControlError: AccessControlError, originalError: any): Promise<void> {
    try {
      // Em produção, enviar para serviço de monitoramento
      if (typeof window !== 'undefined') {
        console.error('Access Control Error:', {
          error: accessControlError,
          originalError: {
            message: originalError?.message,
            stack: originalError?.stack,
            response: originalError?.response?.data
          },
          context: {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            referrer: document.referrer
          }
        })
      }

      // Enviar para API de monitoramento se disponível
      if (accessControlError.severity === 'critical' || accessControlError.severity === 'high') {
        await fetch('/api/monitoring/access-control-errors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: accessControlError,
            originalError: {
              message: originalError?.message,
              stack: originalError?.stack,
              response: originalError?.response?.data
            },
            context: {
              timestamp: new Date().toISOString(),
              userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
              url: typeof window !== 'undefined' ? window.location.href : null
            }
          })
        }).catch(logError => {
          console.error('Failed to log access control error:', logError)
        })
      }
    } catch (logError) {
      console.error('Failed to log access control error:', logError)
    }
  }

  /**
   * Obtém mensagem de ajuda contextual baseada no erro
   */
  static getHelpMessage(error: AccessControlError): string[] {
    switch (error.code) {
      case AccessControlErrorCode.USER_TYPE_NOT_ALLOWED:
        return [
          'Sua conta tem permissões limitadas',
          'Entre em contato com o administrador da sua organização',
          'Ou solicite upgrade de permissões'
        ]

      case AccessControlErrorCode.CLIENT_ACCESS_DENIED:
        return [
          'Você não tem acesso a este cliente específico',
          'Solicite acesso ao administrador da organização',
          'Verifique se está na organização correta'
        ]

      case AccessControlErrorCode.PLAN_LIMIT_EXCEEDED:
        return [
          'Seu plano atual atingiu o limite de recursos',
          'Faça upgrade para continuar criando recursos',
          'Ou remova recursos não utilizados'
        ]

      case AccessControlErrorCode.SUBSCRIPTION_EXPIRED:
        return [
          'Sua assinatura expirou',
          'Renove para continuar usando todas as funcionalidades',
          'Dados existentes permanecem seguros'
        ]

      case AccessControlErrorCode.UNAUTHORIZED:
        return [
          'Faça login para acessar esta funcionalidade',
          'Verifique se sua sessão não expirou',
          'Limpe o cache se o problema persistir'
        ]

      default:
        return [
          'Tente recarregar a página',
          'Verifique sua conexão com a internet',
          'Entre em contato com o suporte se necessário'
        ]
    }
  }

  /**
   * Verifica se o erro é recuperável
   */
  static isRecoverable(error: AccessControlError): boolean {
    return error.recoverable && error.actions.length > 0
  }

  /**
   * Obtém a ação primária recomendada
   */
  static getPrimaryAction(error: AccessControlError): AccessControlErrorAction | null {
    return error.actions.find(action => action.primary) || error.actions[0] || null
  }
}