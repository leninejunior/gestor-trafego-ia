'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AccessControlErrorHandler, AccessControlError, AccessControlErrorCode } from '@/lib/errors/access-control-errors'
import { AccessControlErrorDisplay } from './access-control-error-display'
import { redirectTo403 } from '@/lib/utils/error-redirect'

interface Props {
  children: ReactNode
  fallback?: (error: AccessControlError) => ReactNode
  onError?: (error: AccessControlError, errorInfo: ErrorInfo) => void
  redirectOnError?: boolean
  showErrorDetails?: boolean
}

interface State {
  hasError: boolean
  error: AccessControlError | null
}

export class AccessControlErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    // Converter erro em AccessControlError
    const accessControlError = AccessControlErrorHandler.handleError(error)
    
    return {
      hasError: true,
      error: accessControlError
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const accessControlError = this.state.error

    if (accessControlError) {
      // Chamar callback de erro se fornecido
      this.props.onError?.(accessControlError, errorInfo)

      // Redirecionar para página 403 se configurado
      if (this.props.redirectOnError && this.isAccessControlError(accessControlError)) {
        redirectTo403({ error: accessControlError })
        return
      }

      // Log do erro
      console.error('Access Control Error Boundary caught an error:', {
        error: accessControlError,
        errorInfo,
        componentStack: errorInfo.componentStack
      })
    }
  }

  private isAccessControlError(error: AccessControlError): boolean {
    const accessControlCodes = Object.values(AccessControlErrorCode)
    return accessControlCodes.includes(error.code)
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  private handleBack = () => {
    this.setState({ hasError: false, error: null })
    if (window.history.length > 1) {
      window.history.back()
    } else {
      window.location.href = '/dashboard'
    }
  }

  private handleUpgrade = () => {
    window.location.href = '/dashboard/billing/upgrade'
  }

  private handleLogin = () => {
    window.location.href = '/auth/login'
  }

  private handleContact = () => {
    const error = this.state.error
    if (!error) return

    const subject = encodeURIComponent(`Erro de Acesso - ${error.code}`)
    const body = encodeURIComponent(
      `Olá,\n\nEncontrei um erro de acesso:\n\n` +
      `Código: ${error.code}\n` +
      `Mensagem: ${error.message}\n` +
      `Página: ${window.location.href}\n` +
      `Tipo de usuário: ${error.details?.userType || 'N/A'}\n\n` +
      `Por favor, me ajudem a resolver este problema.\n\n` +
      `Obrigado!`
    )
    window.location.href = `mailto:suporte@exemplo.com?subject=${subject}&body=${body}`
  }

  render() {
    if (this.state.hasError && this.state.error) {
      // Usar fallback customizado se fornecido
      if (this.props.fallback) {
        return this.props.fallback(this.state.error)
      }

      // Renderizar componente de erro padrão
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <AccessControlErrorDisplay
            error={this.state.error}
            onRetry={this.handleRetry}
            onBack={this.handleBack}
            onUpgrade={this.handleUpgrade}
            onLogin={this.handleLogin}
            onContact={this.handleContact}
            className="w-full max-w-2xl"
          />
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Hook para usar o error boundary programaticamente
 */
export function useAccessControlErrorBoundary() {
  const throwError = (error: AccessControlError | Error) => {
    throw error
  }

  const throwAccessControlError = (
    code: AccessControlErrorCode,
    message: string,
    details?: any
  ) => {
    const error = new Error(message)
    ;(error as any).code = code
    ;(error as any).details = details
    throw error
  }

  return {
    throwError,
    throwAccessControlError
  }
}

/**
 * Componente funcional wrapper para o error boundary
 */
interface AccessControlErrorWrapperProps {
  children: ReactNode
  fallback?: (error: AccessControlError) => ReactNode
  onError?: (error: AccessControlError, errorInfo: ErrorInfo) => void
  redirectOnError?: boolean
  showErrorDetails?: boolean
}

export function AccessControlErrorWrapper(props: AccessControlErrorWrapperProps) {
  return (
    <AccessControlErrorBoundary {...props}>
      {props.children}
    </AccessControlErrorBoundary>
  )
}

/**
 * HOC para envolver componentes com error boundary
 */
export function withAccessControlErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <AccessControlErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </AccessControlErrorBoundary>
  )

  WrappedComponent.displayName = `withAccessControlErrorBoundary(${Component.displayName || Component.name})`
  
  return WrappedComponent
}

/**
 * Provider para configuração global do error boundary
 */
interface AccessControlErrorConfigContextType {
  redirectOnError: boolean
  showErrorDetails: boolean
  onError?: (error: AccessControlError, errorInfo: ErrorInfo) => void
}

const AccessControlErrorConfigContext = React.createContext<AccessControlErrorConfigContextType>({
  redirectOnError: false,
  showErrorDetails: true
})

export function AccessControlErrorConfigProvider({
  children,
  redirectOnError = false,
  showErrorDetails = true,
  onError
}: {
  children: ReactNode
  redirectOnError?: boolean
  showErrorDetails?: boolean
  onError?: (error: AccessControlError, errorInfo: ErrorInfo) => void
}) {
  return (
    <AccessControlErrorConfigContext.Provider value={{
      redirectOnError,
      showErrorDetails,
      onError
    }}>
      {children}
    </AccessControlErrorConfigContext.Provider>
  )
}

export function useAccessControlErrorConfig() {
  return React.useContext(AccessControlErrorConfigContext)
}