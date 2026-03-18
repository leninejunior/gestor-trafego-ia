/**
 * Google Ads Error Handler
 * Specialized error handling for Google Ads API
 */

/**
 * Google Ads API error types
 */
export enum GoogleAdsErrorType {
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  QUOTA_ERROR = 'QUOTA_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * Google Ads error details
 */
export interface GoogleAdsError {
  type: GoogleAdsErrorType;
  message: string;
  code?: string;
  retryable: boolean;
  retryAfter?: number; // milliseconds
  details?: any;
}

/**
 * Rate limit configuration
 */
interface RateLimitConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

/**
 * Google Ads Error Handler
 * Handles API errors with retry logic and exponential backoff
 */
export class GoogleAdsErrorHandler {
  private readonly rateLimitConfig: RateLimitConfig = {
    maxRetries: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 60000, // 60 seconds
    backoffMultiplier: 2
  };

  /**
   * Parse Google Ads API error response
   */
  parseError(error: any, statusCode?: number): GoogleAdsError {
    // Handle HTTP status codes
    if (statusCode) {
      switch (statusCode) {
        case 401:
          return {
            type: GoogleAdsErrorType.AUTHENTICATION_ERROR,
            message: 'Authentication failed - invalid or expired token',
            retryable: true,
            details: error
          };
        
        case 403:
          return {
            type: GoogleAdsErrorType.AUTHORIZATION_ERROR,
            message: 'Access denied - insufficient permissions',
            retryable: false,
            details: error
          };
        
        case 429:
          return this.parseRateLimitError(error);
        
        case 404:
          return {
            type: GoogleAdsErrorType.RESOURCE_NOT_FOUND,
            message: 'Resource not found',
            retryable: false,
            details: error
          };
        
        case 500:
        case 502:
        case 503:
        case 504:
          return {
            type: GoogleAdsErrorType.INTERNAL_ERROR,
            message: 'Google Ads API internal error',
            retryable: true,
            retryAfter: 5000,
            details: error
          };
      }
    }

    // Parse Google Ads specific error structure
    if (error?.error) {
      const googleError = error.error;
      
      // Check for specific error codes
      if (googleError.code === 'UNAUTHENTICATED') {
        return {
          type: GoogleAdsErrorType.TOKEN_EXPIRED,
          message: 'Access token expired',
          code: googleError.code,
          retryable: true,
          details: googleError
        };
      }

      if (googleError.code === 'PERMISSION_DENIED') {
        return {
          type: GoogleAdsErrorType.AUTHORIZATION_ERROR,
          message: googleError.message || 'Permission denied',
          code: googleError.code,
          retryable: false,
          details: googleError
        };
      }

      if (googleError.code === 'RESOURCE_EXHAUSTED') {
        return this.parseRateLimitError(googleError);
      }

      if (googleError.code === 'INVALID_ARGUMENT') {
        return {
          type: GoogleAdsErrorType.INVALID_REQUEST,
          message: googleError.message || 'Invalid request parameters',
          code: googleError.code,
          retryable: false,
          details: googleError
        };
      }
    }

    // Network errors
    if (error?.code === 'ECONNREFUSED' || error?.code === 'ETIMEDOUT') {
      return {
        type: GoogleAdsErrorType.NETWORK_ERROR,
        message: 'Network connection failed',
        retryable: true,
        retryAfter: 5000,
        details: error
      };
    }

    // Default unknown error
    return {
      type: GoogleAdsErrorType.UNKNOWN_ERROR,
      message: error?.message || 'Unknown error occurred',
      retryable: false,
      details: error
    };
  }

  /**
   * Parse rate limit error with retry-after information
   */
  private parseRateLimitError(error: any): GoogleAdsError {
    // Try to extract retry-after from error details
    let retryAfter = 60000; // Default 60 seconds

    if (error?.details) {
      // Google Ads may include quota information
      const quotaError = error.details.find((d: any) => 
        d['@type']?.includes('QuotaFailure')
      );
      
      if (quotaError) {
        // Extract retry time if available
        retryAfter = 120000; // 2 minutes for quota errors
      }
    }

    return {
      type: GoogleAdsErrorType.RATE_LIMIT_ERROR,
      message: 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
      retryable: true,
      retryAfter,
      details: error
    };
  }

  /**
   * Determine if error should be retried
   */
  shouldRetry(error: GoogleAdsError, attemptNumber: number): boolean {
    if (!error.retryable) {
      return false;
    }

    if (attemptNumber >= this.rateLimitConfig.maxRetries) {
      return false;
    }

    return true;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  calculateRetryDelay(error: GoogleAdsError, attemptNumber: number): number {
    // Use error-specific retry-after if provided
    if (error.retryAfter) {
      return error.retryAfter;
    }

    // Calculate exponential backoff
    const delay = Math.min(
      this.rateLimitConfig.baseDelay * 
        Math.pow(this.rateLimitConfig.backoffMultiplier, attemptNumber),
      this.rateLimitConfig.maxDelay
    );

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.3 * delay;
    
    return Math.floor(delay + jitter);
  }

  /**
   * Execute function with retry logic
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    context: string = 'API call'
  ): Promise<T> {
    let lastError: GoogleAdsError | null = null;
    
    for (let attempt = 0; attempt < this.rateLimitConfig.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        // Parse error
        const parsedError = this.parseError(
          error,
          error.response?.status || error.status
        );
        
        lastError = parsedError;

        // Check if should retry
        if (!this.shouldRetry(parsedError, attempt)) {
          throw this.formatError(parsedError, context);
        }

        // Calculate delay
        const delay = this.calculateRetryDelay(parsedError, attempt);
        
        console.warn(
          `[GoogleAds] ${context} failed (attempt ${attempt + 1}/${this.rateLimitConfig.maxRetries}): ${parsedError.message}. Retrying in ${delay}ms...`
        );

        // Wait before retry
        await this.sleep(delay);
      }
    }

    // All retries exhausted
    throw this.formatError(
      lastError!,
      `${context} (after ${this.rateLimitConfig.maxRetries} retries)`
    );
  }

  /**
   * Format error for throwing
   */
  private formatError(error: GoogleAdsError, context: string): Error {
    const errorObj = new Error(
      `[GoogleAds] ${context}: ${error.message}`
    );
    
    // Attach additional properties
    (errorObj as any).type = error.type;
    (errorObj as any).code = error.code;
    (errorObj as any).retryable = error.retryable;
    (errorObj as any).details = error.details;
    
    return errorObj;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Handle token expiration
   */
  async handleTokenExpiration(
    refreshTokenFn: () => Promise<string>
  ): Promise<string> {
    try {
      console.log('[GoogleAds] Token expired, attempting refresh...');
      const newToken = await refreshTokenFn();
      console.log('[GoogleAds] Token refreshed successfully');
      return newToken;
    } catch (error) {
      console.error('[GoogleAds] Token refresh failed:', error);
      throw new Error(
        'Failed to refresh access token. User may need to re-authenticate.'
      );
    }
  }

  /**
   * Log error for monitoring
   */
  logError(error: GoogleAdsError, context: string): void {
    const logData = {
      timestamp: new Date().toISOString(),
      context,
      type: error.type,
      message: error.message,
      code: error.code,
      retryable: error.retryable,
      details: error.details
    };

    // In production, send to monitoring service
    console.error('[GoogleAds Error]', JSON.stringify(logData, null, 2));
  }

  /**
   * Check if error is quota-related
   */
  isQuotaError(error: GoogleAdsError): boolean {
    return error.type === GoogleAdsErrorType.QUOTA_ERROR ||
           error.type === GoogleAdsErrorType.RATE_LIMIT_ERROR;
  }

  /**
   * Check if error requires re-authentication
   */
  requiresReauth(error: GoogleAdsError): boolean {
    return error.type === GoogleAdsErrorType.AUTHENTICATION_ERROR ||
           error.type === GoogleAdsErrorType.TOKEN_EXPIRED;
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(error: GoogleAdsError): string {
    switch (error.type) {
      case GoogleAdsErrorType.AUTHENTICATION_ERROR:
      case GoogleAdsErrorType.TOKEN_EXPIRED:
        return 'Your Google Ads connection has expired. Please reconnect your account.';
      
      case GoogleAdsErrorType.AUTHORIZATION_ERROR:
        return 'You don\'t have permission to access this Google Ads account.';
      
      case GoogleAdsErrorType.RATE_LIMIT_ERROR:
      case GoogleAdsErrorType.QUOTA_ERROR:
        return 'Google Ads API rate limit reached. Please try again later.';
      
      case GoogleAdsErrorType.RESOURCE_NOT_FOUND:
        return 'The requested campaign or account was not found.';
      
      case GoogleAdsErrorType.INVALID_REQUEST:
        return 'Invalid request. Please check your input and try again.';
      
      case GoogleAdsErrorType.INTERNAL_ERROR:
        return 'Google Ads API is experiencing issues. Please try again later.';
      
      case GoogleAdsErrorType.NETWORK_ERROR:
        return 'Network connection failed. Please check your internet connection.';
      
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }
}

// Export singleton instance
export const googleAdsErrorHandler = new GoogleAdsErrorHandler();
