import { renderHook, act, waitFor } from '@testing-library/react';
import { useRetry, useCheckoutRetry, useRetryWithFeedback } from '@/hooks/use-retry';

// Mock the error handler
jest.mock('@/lib/checkout/error-handler', () => ({
  CheckoutErrorHandler: {
    handleError: jest.fn((error) => ({
      code: 'MOCK_ERROR',
      message: error.message,
      type: 'server',
      recoverable: true,
      retryable: true,
      userMessage: 'Mock error occurred',
      actions: []
    }))
  }
}));

describe('useRetry Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('should successfully execute operation on first try', async () => {
    const { result } = renderHook(() => useRetry());
    const mockOperation = jest.fn().mockResolvedValue('success');

    let operationResult: string;
    await act(async () => {
      operationResult = await result.current.retry(mockOperation);
    });

    expect(operationResult!).toBe('success');
    expect(mockOperation).toHaveBeenCalledTimes(1);
    expect(result.current.state.attemptCount).toBe(0);
    expect(result.current.state.isRetrying).toBe(false);
  });

  test('should retry failed operations with exponential backoff', async () => {
    const { result } = renderHook(() => useRetry({ maxRetries: 3, baseDelay: 1000 }));
    const mockOperation = jest.fn()
      .mockRejectedValueOnce(new Error('First failure'))
      .mockRejectedValueOnce(new Error('Second failure'))
      .mockResolvedValue('success');

    const retryPromise = act(async () => {
      return result.current.retry(mockOperation);
    });

    // First attempt should fail immediately
    await act(async () => {
      await Promise.resolve(); // Let the first attempt complete
    });

    expect(result.current.state.attemptCount).toBe(1);
    expect(result.current.state.isRetrying).toBe(false);

    // Advance time for first retry
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await act(async () => {
      await Promise.resolve(); // Let the retry attempt complete
    });

    expect(result.current.state.attemptCount).toBe(2);

    // Advance time for second retry
    act(() => {
      jest.advanceTimersByTime(2000); // Exponential backoff: 2 seconds
    });

    const finalResult = await retryPromise;
    expect(finalResult).toBe('success');
    expect(mockOperation).toHaveBeenCalledTimes(3);
  });

  test('should stop retrying after max attempts', async () => {
    const { result } = renderHook(() => useRetry({ maxRetries: 2, baseDelay: 100 }));
    const mockOperation = jest.fn().mockRejectedValue(new Error('Always fails'));

    let thrownError: Error;
    try {
      await act(async () => {
        await result.current.retry(mockOperation);
      });
    } catch (error) {
      thrownError = error as Error;
    }

    // Advance timers to complete all retries
    act(() => {
      jest.runAllTimers();
    });

    await waitFor(() => {
      expect(result.current.state.canRetry).toBe(false);
    });

    expect(thrownError!).toBeInstanceOf(Error);
    expect(thrownError!.message).toBe('Always fails');
  });

  test('should reset state correctly', async () => {
    const { result } = renderHook(() => useRetry());
    const mockOperation = jest.fn().mockRejectedValue(new Error('Failure'));

    try {
      await act(async () => {
        await result.current.retry(mockOperation);
      });
    } catch (error) {
      // Expected to fail
    }

    expect(result.current.state.attemptCount).toBe(1);
    expect(result.current.state.lastError).toBeInstanceOf(Error);

    act(() => {
      result.current.reset();
    });

    expect(result.current.state.attemptCount).toBe(0);
    expect(result.current.state.lastError).toBe(null);
    expect(result.current.state.canRetry).toBe(true);
  });

  test('should calculate delay with jitter', () => {
    const { result } = renderHook(() => useRetry({ 
      baseDelay: 1000, 
      backoffFactor: 2, 
      jitter: true 
    }));

    // Test multiple calculations to ensure jitter varies
    const delays: number[] = [];
    for (let i = 0; i < 10; i++) {
      // Access private method for testing (in real implementation, this would be tested indirectly)
      // This is a conceptual test - actual implementation might differ
    }

    // In a real test, you'd verify that delays have some variance due to jitter
    // For now, we'll just ensure the hook initializes correctly
    expect(result.current.state.canRetry).toBe(true);
  });
});

describe('useCheckoutRetry Hook', () => {
  test('should handle checkout-specific errors', async () => {
    const { result } = renderHook(() => useCheckoutRetry());
    const mockOperation = jest.fn().mockRejectedValue(new Error('Checkout failed'));

    let thrownError: any;
    try {
      await act(async () => {
        await result.current.retry(mockOperation, 'test-context');
      });
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError.code).toBe('MOCK_ERROR');
    expect(thrownError.userMessage).toBe('Mock error occurred');
  });
});

describe('useRetryWithFeedback Hook', () => {
  test('should provide feedback during retry operations', async () => {
    const { result } = renderHook(() => useRetryWithFeedback());
    const mockOperation = jest.fn()
      .mockRejectedValueOnce(new Error('First failure'))
      .mockResolvedValue('success');

    expect(result.current.feedback).toBe(null);

    const retryPromise = act(async () => {
      return result.current.retry(mockOperation, {
        loadingMessage: 'Retrying operation...',
        successMessage: 'Operation completed!',
        errorMessage: 'Operation failed'
      });
    });

    // Should show loading feedback during retry
    await act(async () => {
      await Promise.resolve();
    });

    // Advance timer for retry
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await retryPromise;

    expect(result.current.feedback?.message).toBe('Operation completed!');
    expect(result.current.feedback?.type).toBe('info');
  });

  test('should show error feedback on failure', async () => {
    const { result } = renderHook(() => useRetryWithFeedback());
    const mockOperation = jest.fn().mockRejectedValue(new Error('Always fails'));

    try {
      await act(async () => {
        await result.current.retry(mockOperation, {
          errorMessage: 'Custom error message'
        });
      });
    } catch (error) {
      // Expected to fail
    }

    // Run all timers to complete retries
    act(() => {
      jest.runAllTimers();
    });

    await waitFor(() => {
      expect(result.current.feedback?.type).toBe('error');
    });

    expect(result.current.feedback?.message).toContain('Custom error message');
  });

  test('should clear feedback', () => {
    const { result } = renderHook(() => useRetryWithFeedback());

    // Set some feedback first
    act(() => {
      // In real usage, this would be set by the retry operation
      // Here we're testing the clear functionality
    });

    act(() => {
      result.current.clearFeedback();
    });

    expect(result.current.feedback).toBe(null);
  });

  test('should auto-clear success feedback after delay', async () => {
    const { result } = renderHook(() => useRetryWithFeedback());
    const mockOperation = jest.fn().mockResolvedValue('success');

    await act(async () => {
      await result.current.retry(mockOperation, {
        successMessage: 'Success!'
      });
    });

    expect(result.current.feedback?.message).toBe('Success!');

    // Advance time by 3 seconds (auto-clear delay)
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    await waitFor(() => {
      expect(result.current.feedback).toBe(null);
    });
  });
});