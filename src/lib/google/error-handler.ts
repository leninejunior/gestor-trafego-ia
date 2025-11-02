/**
 * Google Ads Error Handler
 * 
 * Handles specific Google Ads API errors with retry logic
 * Requirements: 10.1, 10.2, 10.3, 10.4
 */

import { googleAdsNotificationService } from './notification-service';

export interface GoogleAdsError {
  code?: string;
  message: string;
  status?: number;
  details?: any;
}

export class GoogleAdsErrorHandler {
  private readonly MAX_RETRIES = 3;
  private readonly BASE_DELAY = 1000; // 1 second

  /**
   * Handle Google Ads API errors
   */
  handleError(error: any, context?: {
    connectionId?: string;
    clientId?: string;
    userId?: string;
    organizationId?: string;
  }): Error {
    // Parse error structure
    const parsedError = this.parseError(error);
    
    // Map to user-friendly message
    const userMessage = this.getUserFriendlyMessage(parsedError);
    
    // Log error for debugging
    this.logError(parsedError);
    
    // Send notification for critical errors
    if (context && this.isCriticalError(parsedError)) {
      this.sendErrorNotification(parsedError, context).catch(err => {
        console.error('[Google Ads Error Handler] Failed to send error notification:', err);
      });
    }
    
    return new Error(userMessage);
  }

  /**
   * Parse error from various formats
   */
  private parseError(error: any): GoogleAdsError {
    // Already a GoogleAdsError
    if (error.code && error.message) {
      return error;
    }

    // Standard Error object
    if (error instanceof Error) {
      return {
        message: error.message,
        code: 'UNKNOWN_ERROR',
      };
    }

    // Google Ads API error response
    if (error.error) {
      return {
        code: error.error.code || error.error.status,
        message: error.error.message || error.error.error_description,
        status: error.error.code,
        details: error.error.details,
      };
    }

    // Fetch error
    if (error.status) {
      return {
        code: `HTTP_${error.status}`,
        message: error.statusText || 'Request failed',
        status: error.status,
      };
    }

    // Unknown error format
    return {
      code: 'UNKNOWN_ERROR',
      message: typeof error === 'string' ? error : 'An unknown error occurred',
    };
  }

  /**
   * Get user-friendly error message
   */
  private getUserFriendlyMessage(error: GoogleAdsError): string {
    const code = error.code?.toUpperCase();

    switch (code) {
      case 'AUTHENTICATION_ERROR':
      case 'UNAUTHENTICATED':
      case 'HTTP_401':
        return 'Falha na autenticação com Google Ads. Por favor, reconecte sua conta.';

      case 'PERMISSION_DENIED':
      case 'HTTP_403':
        return 'Permissões insuficientes na conta Google Ads. Verifique as permissões concedidas.';

      case 'RATE_LIMIT_EXCEEDED':
      case 'RESOURCE_EXHAUSTED':
      case 'HTTP_429':
        return 'Limite de requisições excedido. Aguarde alguns minutos e tente novamente.';

      case 'INVALID_CUSTOMER_ID':
        return 'ID de cliente Google Ads inválido. Verifique a configuração da conta.';

      case 'DEVELOPER_TOKEN_NOT_APPROVED':
        return 'Token de desenvolvedor não aprovado. Entre em contato com o suporte.';

      case 'INVALID_ARGUMENT':
      case 'HTTP_400':
        return 'Parâmetros inválidos na requisição. Verifique os dados enviados.';

      case 'NOT_FOUND':
      case 'HTTP_404':
        return 'Recurso não encontrado no Google Ads.';

      case 'INTERNAL_ERROR':
      case 'HTTP_500':
      case 'HTTP_502':
      case 'HTTP_503':
        return 'Erro interno do Google Ads. Tente novamente em alguns minutos.';

      case 'TIMEOUT':
      case 'HTTP_504':
        return 'Tempo limite excedido ao conectar com Google Ads. Tente novamente.';

      case 'NETWORK_ERROR':
        return 'Erro de conexão. Verifique sua internet e tente novamente.';

      default:
        return `Erro ao comunicar com Google Ads: ${error.message}`;
    }
  }

  /**
   * Log error for debugging
   */
  private logError(error: GoogleAdsError): void {
    console.error('[Google Ads Error]', {
      code: error.code,
      message: error.message,
      status: error.status,
      details: error.details,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Check if error is retryable
   */
  isRetryable(error: GoogleAdsError): boolean {
    const retryableCodes = [
      'RATE_LIMIT_EXCEEDED',
      'RESOURCE_EXHAUSTED',
      'INTERNAL_ERROR',
      'TIMEOUT',
      'NETWORK_ERROR',
      'HTTP_429',
      'HTTP_500',
      'HTTP_502',
      'HTTP_503',
      'HTTP_504',
    ];

    return retryableCodes.includes(error.code?.toUpperCase() || '');
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  getRetryDelay(attemptNumber: number): number {
    return Math.min(
      this.BASE_DELAY * Math.pow(2, attemptNumber),
      60000 // Max 60 seconds
    );
  }

  /**
   * Execute function with retry logic
   */
  async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = this.MAX_RETRIES
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        const parsedError = this.parseError(error);

        // Don't retry if error is not retryable
        if (!this.isRetryable(parsedError)) {
          throw this.handleError(error);
        }

        // Don't retry on last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Wait before retrying
        const delay = this.getRetryDelay(attempt);
        console.log(`[Google Ads] Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await this.sleep(delay);
      }
    }

    throw this.handleError(lastError);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if error is critical and requires notification
   */
  private isCriticalError(error: GoogleAdsError): boolean {
    const criticalCodes = [
      'AUTHENTICATION_ERROR',
      'UNAUTHENTICATED',
      'PERMISSION_DENIED',
      'DEVELOPER_TOKEN_NOT_APPROVED',
      'INVALID_CUSTOMER_ID',
      'HTTP_401',
      'HTTP_403'
    ];

    return criticalCodes.includes(error.code?.toUpperCase() || '');
  }

  /**
   * Send error notification
   */
  private async sendErrorNotification(
    error: GoogleAdsError,
    context: {
      connectionId?: string;
      clientId?: string;
      userId?: string;
      organizationId?: string;
    }
  ): Promise<void> {
    if (!context.userId || !context.organizationId) {
      return;
    }

    const errorType = this.getErrorType(error);
    
    await googleAdsNotificationService.notifyError({
      connectionId: context.connectionId || '',
      clientId: context.clientId || '',
      userId: context.userId,
      organizationId: context.organizationId,
      errorType,
      errorCode: error.code,
      errorMessage: error.message,
      isRetryable: this.isRetryable(error)
    });
  }

  /**
   * Get error type for notification
   */
  private getErrorType(error: GoogleAdsError): 'auth' | 'api' | 'sync' | 'connection' {
    const code = error.code?.toUpperCase();
    
    if (['AUTHENTICATION_ERROR', 'UNAUTHENTICATED', 'HTTP_401'].includes(code || '')) {
      return 'auth';
    }
    
    if (['PERMISSION_DENIED', 'HTTP_403'].includes(code || '')) {
      return 'auth';
    }
    
    if (['NETWORK_ERROR', 'TIMEOUT', 'HTTP_504'].includes(code || '')) {
      return 'connection';
    }
    
    return 'api';
  }
}
