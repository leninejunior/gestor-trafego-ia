import { AccessControlError, AccessControlErrorCode } from '@/lib/errors/access-control-errors'
import { UserType } from '@/lib/services/user-access-control'

interface ErrorRedirectOptions {
  error?: AccessControlError
  errorCode?: AccessControlErrorCode
  userType?: UserType
  requiredUserType?: UserType
  clientId?: string
  clientName?: string
  currentUsage?: number
  limit?: number
  customMessage?: string
  returnUrl?: string
}

/**
 * Redireciona para a página de erro 403 com contexto específico
 */
export function redirectTo403(options: ErrorRedirectOptions = {}) {
  const params = new URLSearchParams()

  // Se um erro completo foi fornecido, extrair informações dele
  if (options.error) {
    params.set('code', options.error.code)
    params.set('message', options.error.userMessage)
    
    if (options.error.details?.userType) {
      params.set('userType', options.error.details.userType)
    }
    if (options.error.details?.requiredPermission) {
      params.set('requiredUserType', options.error.details.requiredPermission)
    }
    if (options.error.details?.clientId) {
      params.set('clientId', options.error.details.clientId)
    }
    if (options.error.details?.currentUsage !== undefined) {
      params.set('currentUsage', options.error.details.currentUsage.toString())
    }
    if (options.error.details?.limit !== undefined) {
      params.set('limit', options.error.details.limit.toString())
    }
  } else {
    // Usar parâmetros individuais
    if (options.errorCode) {
      params.set('code', options.errorCode)
    }
    if (options.customMessage) {
      params.set('message', options.customMessage)
    }
    if (options.userType) {
      params.set('userType', options.userType)
    }
    if (options.requiredUserType) {
      params.set('requiredUserType', options.requiredUserType)
    }
    if (options.clientId) {
      params.set('clientId', options.clientId)
    }
    if (options.clientName) {
      params.set('clientName', options.clientName)
    }
    if (options.currentUsage !== undefined) {
      params.set('currentUsage', options.currentUsage.toString())
    }
    if (options.limit !== undefined) {
      params.set('limit', options.limit.toString())
    }
  }

  // Adicionar URL de retorno se não especificada
  if (options.returnUrl) {
    params.set('returnUrl', options.returnUrl)
  } else if (typeof window !== 'undefined') {
    params.set('returnUrl', window.location.href)
  }

  // Redirecionar
  const url = `/error/403?${params.toString()}`
  
  if (typeof window !== 'undefined') {
    window.location.href = url
  }
  
  return url
}

/**
 * Funções de conveniência para tipos específicos de erro
 */
export const errorRedirects = {
  /**
   * Redireciona para erro de tipo de usuário não permitido
   */
  userTypeNotAllowed: (userType: UserType, requiredUserType: UserType, customMessage?: string) => {
    return redirectTo403({
      errorCode: AccessControlErrorCode.USER_TYPE_NOT_ALLOWED,
      userType,
      requiredUserType,
      customMessage
    })
  },

  /**
   * Redireciona para erro de acesso ao cliente negado
   */
  clientAccessDenied: (clientId: string, clientName?: string, userType?: UserType) => {
    return redirectTo403({
      errorCode: AccessControlErrorCode.CLIENT_ACCESS_DENIED,
      clientId,
      clientName,
      userType
    })
  },

  /**
   * Redireciona para erro de limite de plano atingido
   */
  planLimitExceeded: (currentUsage: number, limit: number, userType?: UserType) => {
    return redirectTo403({
      errorCode: AccessControlErrorCode.PLAN_LIMIT_EXCEEDED,
      currentUsage,
      limit,
      userType
    })
  },

  /**
   * Redireciona para erro de assinatura expirada
   */
  subscriptionExpired: (userType?: UserType) => {
    return redirectTo403({
      errorCode: AccessControlErrorCode.SUBSCRIPTION_EXPIRED,
      userType
    })
  },

  /**
   * Redireciona para erro genérico de acesso negado
   */
  accessDenied: (userType?: UserType, customMessage?: string) => {
    return redirectTo403({
      errorCode: AccessControlErrorCode.FORBIDDEN,
      userType,
      customMessage
    })
  },

  /**
   * Redireciona para erro de não autorizado
   */
  unauthorized: (customMessage?: string) => {
    return redirectTo403({
      errorCode: AccessControlErrorCode.UNAUTHORIZED,
      customMessage
    })
  }
}

/**
 * Hook para usar redirecionamentos de erro em componentes React
 */
export function useErrorRedirect() {
  const redirect403 = (options: ErrorRedirectOptions) => {
    return redirectTo403(options)
  }

  return {
    redirect403,
    ...errorRedirects
  }
}

/**
 * Middleware helper para redirecionar com erro de API
 */
export function createErrorRedirectResponse(error: AccessControlError, returnUrl?: string) {
  const redirectUrl = redirectTo403({ error, returnUrl })
  
  // Para uso em middleware/API routes
  return {
    redirect: redirectUrl,
    status: 403,
    headers: {
      'Location': redirectUrl
    }
  }
}

/**
 * Função para extrair informações de erro de uma resposta de API
 */
export function extractErrorFromResponse(response: any): ErrorRedirectOptions {
  const data = response?.data || response
  
  return {
    errorCode: data?.code as AccessControlErrorCode,
    userType: data?.userType as UserType,
    customMessage: data?.error || data?.message,
    clientId: data?.details?.clientId,
    currentUsage: data?.currentUsage,
    limit: data?.limit
  }
}

/**
 * Função para verificar se uma resposta de API é um erro de acesso
 */
export function isAccessControlError(response: any): boolean {
  const status = response?.status || response?.response?.status
  const code = response?.data?.code || response?.response?.data?.code
  
  return (
    status === 401 || 
    status === 403 || 
    status === 402 ||
    Object.values(AccessControlErrorCode).includes(code)
  )
}

/**
 * Interceptor para axios/fetch que automaticamente redireciona erros de acesso
 */
export function createAccessControlInterceptor() {
  return {
    onError: (error: any) => {
      if (isAccessControlError(error)) {
        const errorOptions = extractErrorFromResponse(error.response || error)
        redirectTo403(errorOptions)
      }
      return Promise.reject(error)
    }
  }
}