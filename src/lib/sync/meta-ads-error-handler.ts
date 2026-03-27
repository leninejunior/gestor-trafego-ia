/**
 * Meta Ads Error Handler
 * Specialized error handling for Meta Marketing API
 */

/**
 * Meta Ads API error types
 */
export enum MetaAdsErrorType {
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * Meta Ads API error details
 */
export interface MetaAdsError {
  type: MetaAdsErrorType;
  message: string;
  code?: string;
  subcode?: number;
  retryable: boolean;
  retryAfter?: number;
  details?: unknown;
}

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

interface MetaGraphError {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  is_transient?: boolean;
  fbtrace_id?: string;
}

/**
 * Handles Meta API errors with retry logic and exponential backoff
 */
export class MetaAdsErrorHandler {
  private readonly retryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 60000,
    backoffMultiplier: 2
  };

  parseError(error: unknown, statusCode?: number): MetaAdsError {
    if (statusCode) {
      switch (statusCode) {
        case 400:
          return {
            type: MetaAdsErrorType.INVALID_REQUEST,
            message: 'Invalid request sent to Meta API',
            retryable: false,
            details: error
          };
        case 401:
          return {
            type: MetaAdsErrorType.AUTHENTICATION_ERROR,
            message: 'Authentication failed for Meta API',
            retryable: true,
            details: error
          };
        case 403:
          return {
            type: MetaAdsErrorType.AUTHORIZATION_ERROR,
            message: 'Insufficient permissions for Meta API resource',
            retryable: false,
            details: error
          };
        case 404:
          return {
            type: MetaAdsErrorType.RESOURCE_NOT_FOUND,
            message: 'Meta API resource not found',
            retryable: false,
            details: error
          };
        case 429:
          return {
            type: MetaAdsErrorType.RATE_LIMIT_ERROR,
            message: 'Meta API rate limit exceeded',
            retryable: true,
            retryAfter: 30000,
            details: error
          };
        case 500:
        case 502:
        case 503:
        case 504:
          return {
            type: MetaAdsErrorType.INTERNAL_ERROR,
            message: 'Meta API internal error',
            retryable: true,
            retryAfter: 5000,
            details: error
          };
      }
    }

    const graphError = this.extractGraphError(error);
    if (graphError) {
      if (graphError.code === 190) {
        return {
          type: MetaAdsErrorType.TOKEN_EXPIRED,
          message: graphError.message || 'Meta access token expired',
          code: String(graphError.code),
          subcode: graphError.error_subcode,
          retryable: true,
          details: graphError
        };
      }

      if (graphError.code === 10 || graphError.code === 200) {
        return {
          type: MetaAdsErrorType.AUTHORIZATION_ERROR,
          message: graphError.message || 'Permission denied by Meta API',
          code: String(graphError.code),
          subcode: graphError.error_subcode,
          retryable: false,
          details: graphError
        };
      }

      if (graphError.code === 4 || graphError.code === 17 || graphError.code === 341) {
        return {
          type: MetaAdsErrorType.RATE_LIMIT_ERROR,
          message: graphError.message || 'Meta API call limit reached',
          code: String(graphError.code),
          subcode: graphError.error_subcode,
          retryable: true,
          retryAfter: 30000,
          details: graphError
        };
      }

      if (graphError.code === 100) {
        return {
          type: MetaAdsErrorType.INVALID_REQUEST,
          message: graphError.message || 'Invalid Meta API request parameters',
          code: String(graphError.code),
          subcode: graphError.error_subcode,
          retryable: false,
          details: graphError
        };
      }

      if (graphError.is_transient) {
        return {
          type: MetaAdsErrorType.INTERNAL_ERROR,
          message: graphError.message || 'Transient Meta API error',
          code: graphError.code ? String(graphError.code) : undefined,
          subcode: graphError.error_subcode,
          retryable: true,
          retryAfter: 5000,
          details: graphError
        };
      }
    }

    const errorObj = this.asErrorObject(error);
    if (errorObj.code === 'ECONNREFUSED' || errorObj.code === 'ETIMEDOUT') {
      return {
        type: MetaAdsErrorType.NETWORK_ERROR,
        message: errorObj.message || 'Network connection failed',
        retryable: true,
        retryAfter: 5000,
        details: error
      };
    }

    return {
      type: MetaAdsErrorType.UNKNOWN_ERROR,
      message: errorObj.message || 'Unknown Meta API error',
      retryable: false,
      details: error
    };
  }

  shouldRetry(error: MetaAdsError, attemptNumber: number): boolean {
    if (!error.retryable) {
      return false;
    }

    return attemptNumber < this.retryConfig.maxRetries;
  }

  calculateRetryDelay(error: MetaAdsError, attemptNumber: number): number {
    if (error.retryAfter) {
      return error.retryAfter;
    }

    const delay = Math.min(
      this.retryConfig.baseDelay *
        Math.pow(this.retryConfig.backoffMultiplier, attemptNumber),
      this.retryConfig.maxDelay
    );

    const jitter = Math.random() * 0.3 * delay;
    return Math.floor(delay + jitter);
  }

  async executeWithRetry<T>(
    fn: () => Promise<T>,
    context: string = 'Meta API call'
  ): Promise<T> {
    let lastError: MetaAdsError | null = null;

    for (let attempt = 0; attempt < this.retryConfig.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        const parsedError = this.parseError(
          error,
          this.asErrorObject(error).status as number | undefined
        );
        lastError = parsedError;

        if (!this.shouldRetry(parsedError, attempt + 1)) {
          throw this.formatError(parsedError, context);
        }

        const delay = this.calculateRetryDelay(parsedError, attempt);
        console.warn(
          '[MetaAds] ' +
            context +
            ' failed (attempt ' +
            (attempt + 1) +
            '/' +
            this.retryConfig.maxRetries +
            '): ' +
            parsedError.message +
            '. Retrying in ' +
            delay +
            'ms...'
        );

        await this.sleep(delay);
      }
    }

    throw this.formatError(
      lastError || {
        type: MetaAdsErrorType.UNKNOWN_ERROR,
        message: 'Retries exhausted',
        retryable: false
      },
      context + ' (after ' + this.retryConfig.maxRetries + ' retries)'
    );
  }

  requiresReauth(error: MetaAdsError): boolean {
    return (
      error.type === MetaAdsErrorType.AUTHENTICATION_ERROR ||
      error.type === MetaAdsErrorType.TOKEN_EXPIRED
    );
  }

  logError(error: MetaAdsError, context: string): void {
    console.error(
      '[MetaAds Error]',
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          context,
          type: error.type,
          message: error.message,
          code: error.code,
          subcode: error.subcode,
          retryable: error.retryable,
          details: error.details
        },
        null,
        2
      )
    );
  }

  private formatError(error: MetaAdsError, context: string): Error {
    const errorObj = new Error('[MetaAds] ' + context + ': ' + error.message);
    (errorObj as Error & { type?: MetaAdsErrorType }).type = error.type;
    (errorObj as Error & { code?: string }).code = error.code;
    (errorObj as Error & { retryable?: boolean }).retryable = error.retryable;
    return errorObj;
  }

  private extractGraphError(error: unknown): MetaGraphError | null {
    if (typeof error !== 'object' || error === null) {
      return null;
    }

    const maybeRecord = error as Record<string, unknown>;
    const graphError = maybeRecord.error;
    if (!graphError || typeof graphError !== 'object') {
      return null;
    }

    return graphError as MetaGraphError;
  }

  private asErrorObject(error: unknown): {
    message?: string;
    code?: string;
    status?: number;
  } {
    if (error instanceof Error) {
      return {
        message: error.message,
        code: (error as Error & { code?: string }).code,
        status: (error as Error & { status?: number }).status
      };
    }

    if (typeof error === 'object' && error !== null) {
      const record = error as Record<string, unknown>;
      return {
        message: typeof record.message === 'string' ? record.message : undefined,
        code: typeof record.code === 'string' ? record.code : undefined,
        status: typeof record.status === 'number' ? record.status : undefined
      };
    }

    return {};
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const metaAdsErrorHandler = new MetaAdsErrorHandler();
