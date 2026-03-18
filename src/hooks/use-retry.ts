'use client';

import { useState, useCallback, useRef } from 'react';
import { CheckoutErrorHandler } from '@/lib/checkout/error-handler';

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  jitter?: boolean;
}

interface RetryState {
  isRetrying: boolean;
  attemptCount: number;
  lastError: Error | null;
  canRetry: boolean;
}

interface UseRetryReturn {
  retry: <T>(operation: () => Promise<T>) => Promise<T>;
  reset: () => void;
  state: RetryState;
}

export function useRetry(options: RetryOptions = {}): UseRetryReturn {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    backoffFactor = 2,
    jitter = true
  } = options;

  const [state, setState] = useState<RetryState>({
    isRetrying: false,
    attemptCount: 0,
    lastError: null,
    canRetry: true
  });

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const calculateDelay = useCallback((attempt: number): number => {
    let delay = Math.min(baseDelay * Math.pow(backoffFactor, attempt), maxDelay);
    
    if (jitter) {
      // Add random jitter (±10%)
      const jitterAmount = delay * 0.1;
      delay += (Math.random() - 0.5) * 2 * jitterAmount;
    }
    
    return Math.max(delay, 0);
  }, [baseDelay, backoffFactor, maxDelay, jitter]);

  const retry = useCallback(async <T>(operation: () => Promise<T>): Promise<T> => {
    if (state.attemptCount >= maxRetries) {
      throw new Error(`Maximum retry attempts (${maxRetries}) exceeded`);
    }

    setState(prev => ({
      ...prev,
      isRetrying: true,
      attemptCount: prev.attemptCount + 1
    }));

    try {
      const result = await operation();
      
      // Success - reset state
      setState({
        isRetrying: false,
        attemptCount: 0,
        lastError: null,
        canRetry: true
      });
      
      return result;
    } catch (error) {
      const currentAttempt = state.attemptCount + 1;
      const canRetryAgain = currentAttempt < maxRetries;
      
      setState(prev => ({
        ...prev,
        isRetrying: false,
        lastError: error as Error,
        canRetry: canRetryAgain
      }));

      if (canRetryAgain) {
        // Schedule next retry with delay
        const delay = calculateDelay(currentAttempt);
        
        return new Promise((resolve, reject) => {
          timeoutRef.current = setTimeout(async () => {
            try {
              const result = await retry(operation);
              resolve(result);
            } catch (retryError) {
              reject(retryError);
            }
          }, delay);
        });
      } else {
        // No more retries available
        throw error;
      }
    }
  }, [state.attemptCount, maxRetries, calculateDelay]);

  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    setState({
      isRetrying: false,
      attemptCount: 0,
      lastError: null,
      canRetry: true
    });
  }, []);

  return {
    retry,
    reset,
    state
  };
}

// Hook específico para operações de checkout
export function useCheckoutRetry() {
  const baseRetry = useRetry({
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2,
    jitter: true
  });

  const retryWithErrorHandling = useCallback(async <T>(
    operation: () => Promise<T>,
    context?: string
  ): Promise<T> => {
    try {
      return await baseRetry.retry(operation);
    } catch (error) {
      // Use checkout error handler to process the error
      const checkoutError = CheckoutErrorHandler.handleError(error);
      
      // Log the retry failure
      console.error(`Checkout retry failed after ${baseRetry.state.attemptCount} attempts:`, {
        context,
        error: checkoutError,
        originalError: error
      });
      
      throw checkoutError;
    }
  }, [baseRetry]);

  return {
    ...baseRetry,
    retry: retryWithErrorHandling
  };
}

// Hook para retry com feedback visual
export function useRetryWithFeedback() {
  const retry = useCheckoutRetry();
  const [feedback, setFeedback] = useState<{
    message: string;
    type: 'info' | 'warning' | 'error';
  } | null>(null);

  const retryWithFeedback = useCallback(async <T>(
    operation: () => Promise<T>,
    options?: {
      loadingMessage?: string;
      successMessage?: string;
      errorMessage?: string;
    }
  ): Promise<T> => {
    const {
      loadingMessage = 'Tentando novamente...',
      successMessage = 'Operação realizada com sucesso!',
      errorMessage = 'Falha na operação'
    } = options || {};

    try {
      if (retry.state.attemptCount > 0) {
        setFeedback({
          message: `${loadingMessage} (Tentativa ${retry.state.attemptCount + 1})`,
          type: 'info'
        });
      }

      const result = await retry.retry(operation);
      
      setFeedback({
        message: successMessage,
        type: 'info'
      });
      
      // Clear success message after delay
      setTimeout(() => setFeedback(null), 3000);
      
      return result;
    } catch (error) {
      setFeedback({
        message: `${errorMessage}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        type: 'error'
      });
      
      throw error;
    }
  }, [retry]);

  const clearFeedback = useCallback(() => {
    setFeedback(null);
  }, []);

  return {
    ...retry,
    retry: retryWithFeedback,
    feedback,
    clearFeedback
  };
}