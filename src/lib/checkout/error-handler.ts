export interface CheckoutError {
  code: string;
  message: string;
  type: 'validation' | 'payment' | 'network' | 'server' | 'timeout' | 'rate_limit';
  recoverable: boolean;
  retryable: boolean;
  userMessage: string;
  actions: ErrorAction[];
}

export interface ErrorAction {
  type: 'retry' | 'redirect' | 'contact' | 'refresh' | 'back';
  label: string;
  primary?: boolean;
  handler?: () => void | Promise<void>;
  url?: string;
}

export class CheckoutErrorHandler {
  private static errorMap: Record<string, Partial<CheckoutError>> = {
    // Validation Errors
    'INVALID_EMAIL': {
      type: 'validation',
      userMessage: 'Por favor, informe um email válido',
      recoverable: true,
      retryable: false,
      actions: [{ type: 'back', label: 'Corrigir Dados', primary: true }]
    },
    'INVALID_PLAN': {
      type: 'validation',
      userMessage: 'Plano selecionado inválido',
      recoverable: true,
      retryable: false,
      actions: [
        { type: 'redirect', label: 'Escolher Plano', url: '/', primary: true }
      ]
    },
    'MISSING_REQUIRED_FIELDS': {
      type: 'validation',
      userMessage: 'Preencha todos os campos obrigatórios',
      recoverable: true,
      retryable: false,
      actions: [{ type: 'back', label: 'Corrigir Dados', primary: true }]
    },

    // Payment Errors
    'PAYMENT_GATEWAY_ERROR': {
      type: 'payment',
      userMessage: 'Erro no processamento do pagamento. Tente novamente.',
      recoverable: true,
      retryable: true,
      actions: [
        { type: 'retry', label: 'Tentar Novamente', primary: true },
        { type: 'contact', label: 'Contatar Suporte' }
      ]
    },
    'PAYMENT_DECLINED': {
      type: 'payment',
      userMessage: 'Pagamento recusado. Verifique os dados do cartão.',
      recoverable: true,
      retryable: true,
      actions: [
        { type: 'retry', label: 'Tentar Outro Cartão', primary: true },
        { type: 'contact', label: 'Precisa de Ajuda?' }
      ]
    },
    'INSUFFICIENT_FUNDS': {
      type: 'payment',
      userMessage: 'Saldo insuficiente. Tente outro método de pagamento.',
      recoverable: true,
      retryable: true,
      actions: [
        { type: 'retry', label: 'Outro Método', primary: true },
        { type: 'contact', label: 'Falar com Suporte' }
      ]
    },

    // Network Errors
    'NETWORK_ERROR': {
      type: 'network',
      userMessage: 'Problema de conexão. Verifique sua internet.',
      recoverable: true,
      retryable: true,
      actions: [
        { type: 'retry', label: 'Tentar Novamente', primary: true },
        { type: 'refresh', label: 'Recarregar Página' }
      ]
    },
    'TIMEOUT_ERROR': {
      type: 'timeout',
      userMessage: 'A operação demorou mais que o esperado.',
      recoverable: true,
      retryable: true,
      actions: [
        { type: 'retry', label: 'Tentar Novamente', primary: true },
        { type: 'refresh', label: 'Recarregar Página' }
      ]
    },

    // Server Errors
    'SERVER_ERROR': {
      type: 'server',
      userMessage: 'Erro interno do servidor. Nosso time foi notificado.',
      recoverable: true,
      retryable: true,
      actions: [
        { type: 'retry', label: 'Tentar Novamente', primary: true },
        { type: 'contact', label: 'Contatar Suporte' }
      ]
    },
    'SERVICE_UNAVAILABLE': {
      type: 'server',
      userMessage: 'Serviço temporariamente indisponível.',
      recoverable: true,
      retryable: true,
      actions: [
        { type: 'retry', label: 'Tentar em Alguns Minutos', primary: true },
        { type: 'contact', label: 'Reportar Problema' }
      ]
    },

    // Rate Limiting
    'RATE_LIMIT_EXCEEDED': {
      type: 'rate_limit',
      userMessage: 'Muitas tentativas. Aguarde alguns minutos.',
      recoverable: true,
      retryable: true,
      actions: [
        { type: 'back', label: 'Aguardar e Tentar', primary: true },
        { type: 'contact', label: 'Precisa de Ajuda?' }
      ]
    }
  };

  static handleError(error: any): CheckoutError {
    let errorCode = 'UNKNOWN_ERROR';
    let message = 'Erro desconhecido';

    // Extract error information
    if (error?.response) {
      // HTTP error response
      const status = error.response.status;
      const data = error.response.data;
      
      if (status === 400) {
        errorCode = data?.code || 'VALIDATION_ERROR';
        message = data?.message || 'Dados inválidos';
      } else if (status === 401) {
        errorCode = 'UNAUTHORIZED';
        message = 'Não autorizado';
      } else if (status === 403) {
        errorCode = 'FORBIDDEN';
        message = 'Acesso negado';
      } else if (status === 404) {
        errorCode = 'NOT_FOUND';
        message = 'Recurso não encontrado';
      } else if (status === 429) {
        errorCode = 'RATE_LIMIT_EXCEEDED';
        message = 'Muitas tentativas';
      } else if (status >= 500) {
        errorCode = 'SERVER_ERROR';
        message = 'Erro interno do servidor';
      }
    } else if (error?.code) {
      // Network or other coded errors
      if (error.code === 'NETWORK_ERROR' || error.code === 'ERR_NETWORK') {
        errorCode = 'NETWORK_ERROR';
        message = 'Erro de conexão';
      } else if (error.code === 'TIMEOUT') {
        errorCode = 'TIMEOUT_ERROR';
        message = 'Timeout';
      } else {
        errorCode = error.code;
        message = error.message || message;
      }
    } else if (error?.message) {
      message = error.message;
      
      // Try to infer error type from message
      if (message.toLowerCase().includes('network')) {
        errorCode = 'NETWORK_ERROR';
      } else if (message.toLowerCase().includes('timeout')) {
        errorCode = 'TIMEOUT_ERROR';
      } else if (message.toLowerCase().includes('payment')) {
        errorCode = 'PAYMENT_GATEWAY_ERROR';
      }
    }

    // Get error configuration
    const errorConfig = this.errorMap[errorCode] || {};
    
    const checkoutError: CheckoutError = {
      code: errorCode,
      message,
      type: errorConfig.type || 'server',
      recoverable: errorConfig.recoverable ?? true,
      retryable: errorConfig.retryable ?? true,
      userMessage: errorConfig.userMessage || message,
      actions: errorConfig.actions || [
        { type: 'retry', label: 'Tentar Novamente', primary: true },
        { type: 'contact', label: 'Contatar Suporte' }
      ]
    };

    // Log error for monitoring
    this.logError(checkoutError, error);

    return checkoutError;
  }

  static async logError(checkoutError: CheckoutError, originalError: any) {
    try {
      await fetch('/api/monitoring/checkout-errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: checkoutError,
          originalError: {
            message: originalError?.message,
            stack: originalError?.stack,
            code: originalError?.code,
            response: originalError?.response?.data
          },
          context: {
            timestamp: new Date().toISOString(),
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
            url: typeof window !== 'undefined' ? window.location.href : null,
            referrer: typeof document !== 'undefined' ? document.referrer : null
          }
        })
      });
    } catch (logError) {
      console.error('Failed to log checkout error:', logError);
    }
  }

  static getRetryDelay(attemptCount: number): number {
    // Exponential backoff with jitter
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, attemptCount), maxDelay);
    const jitter = Math.random() * 0.1 * exponentialDelay;
    
    return exponentialDelay + jitter;
  }

  static shouldRetry(error: CheckoutError, attemptCount: number): boolean {
    const maxRetries = 3;
    
    if (attemptCount >= maxRetries) {
      return false;
    }

    if (!error.retryable) {
      return false;
    }

    // Don't retry validation errors
    if (error.type === 'validation') {
      return false;
    }

    return true;
  }
}