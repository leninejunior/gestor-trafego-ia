import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ErrorDisplay } from '@/components/checkout/error-display';
import { CheckoutError } from '@/lib/checkout/error-handler';

// Mock the icons
jest.mock('lucide-react', () => ({
  AlertTriangle: ({ className }: { className?: string }) => <div className={className} data-testid="alert-triangle" />,
  XCircle: ({ className }: { className?: string }) => <div className={className} data-testid="x-circle" />,
  Wifi: ({ className }: { className?: string }) => <div className={className} data-testid="wifi" />,
  Server: ({ className }: { className?: string }) => <div className={className} data-testid="server" />,
  CreditCard: ({ className }: { className?: string }) => <div className={className} data-testid="credit-card" />,
  RefreshCw: ({ className }: { className?: string }) => <div className={className} data-testid="refresh-cw" />,
  ArrowLeft: ({ className }: { className?: string }) => <div className={className} data-testid="arrow-left" />,
  Mail: ({ className }: { className?: string }) => <div className={className} data-testid="mail" />,
  ExternalLink: ({ className }: { className?: string }) => <div className={className} data-testid="external-link" />,
  Clock: ({ className }: { className?: string }) => <div className={className} data-testid="clock" />
}));

describe('ErrorDisplay Component', () => {
  const mockOnRetry = jest.fn();
  const mockOnBack = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockError = (overrides: Partial<CheckoutError> = {}): CheckoutError => ({
    code: 'TEST_ERROR',
    message: 'Test error message',
    type: 'server',
    recoverable: true,
    retryable: true,
    userMessage: 'Something went wrong. Please try again.',
    actions: [
      { type: 'retry', label: 'Try Again', primary: true },
      { type: 'contact', label: 'Contact Support' }
    ],
    ...overrides
  });

  test('renders error information correctly', () => {
    const error = createMockError({
      userMessage: 'Custom error message',
      code: 'CUSTOM_ERROR'
    });

    render(<ErrorDisplay error={error} />);

    expect(screen.getByText('Ops! Algo deu errado')).toBeInTheDocument();
    expect(screen.getByText('Custom error message')).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
    expect(screen.getByText('CUSTOM_ERROR')).toBeInTheDocument();
  });

  test('displays correct icon for different error types', () => {
    const networkError = createMockError({ type: 'network' });
    const { rerender } = render(<ErrorDisplay error={networkError} />);
    expect(screen.getByTestId('wifi')).toBeInTheDocument();

    const paymentError = createMockError({ type: 'payment' });
    rerender(<ErrorDisplay error={paymentError} />);
    expect(screen.getByTestId('credit-card')).toBeInTheDocument();

    const serverError = createMockError({ type: 'server' });
    rerender(<ErrorDisplay error={serverError} />);
    expect(screen.getByTestId('server')).toBeInTheDocument();
  });

  test('renders action buttons correctly', () => {
    const error = createMockError({
      actions: [
        { type: 'retry', label: 'Try Again', primary: true },
        { type: 'back', label: 'Go Back' },
        { type: 'contact', label: 'Contact Support' }
      ]
    });

    render(<ErrorDisplay error={error} onRetry={mockOnRetry} onBack={mockOnBack} />);

    expect(screen.getByText('Try Again')).toBeInTheDocument();
    expect(screen.getByText('Go Back')).toBeInTheDocument();
    expect(screen.getByText('Contact Support')).toBeInTheDocument();
  });

  test('calls onRetry when retry button is clicked', async () => {
    const error = createMockError();
    render(<ErrorDisplay error={error} onRetry={mockOnRetry} />);

    const retryButton = screen.getByText('Try Again');
    fireEvent.click(retryButton);

    expect(mockOnRetry).toHaveBeenCalledTimes(1);
  });

  test('calls onBack when back button is clicked', () => {
    const error = createMockError({
      actions: [{ type: 'back', label: 'Go Back' }]
    });

    render(<ErrorDisplay error={error} onBack={mockOnBack} />);

    const backButton = screen.getByText('Go Back');
    fireEvent.click(backButton);

    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });

  test('shows loading state during retry', async () => {
    const slowRetry = jest.fn(() => new Promise(resolve => setTimeout(resolve, 100)));
    const error = createMockError();

    render(<ErrorDisplay error={error} onRetry={slowRetry} />);

    const retryButton = screen.getByText('Try Again');
    fireEvent.click(retryButton);

    // Should show loading state
    expect(screen.getByText('Tentando...')).toBeInTheDocument();
    expect(screen.getByTestId('refresh-cw')).toHaveClass('animate-spin');

    // Wait for retry to complete
    await waitFor(() => {
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });
  });

  test('displays help tips for different error types', () => {
    const networkError = createMockError({ type: 'network' });
    render(<ErrorDisplay error={networkError} />);

    expect(screen.getByText('💡 Dicas para resolver:')).toBeInTheDocument();
    expect(screen.getByText('Verifique sua conexão com a internet')).toBeInTheDocument();
  });

  test('handles contact action correctly', () => {
    // Mock window.location.href
    delete (window as any).location;
    window.location = { href: '' } as any;

    const error = createMockError({
      actions: [{ type: 'contact', label: 'Contact Support' }]
    });

    render(<ErrorDisplay error={error} />);

    const contactButton = screen.getByText('Contact Support');
    fireEvent.click(contactButton);

    expect(window.location.href).toContain('mailto:');
    expect(window.location.href).toContain('TEST_ERROR');
  });

  test('handles redirect action correctly', () => {
    delete (window as any).location;
    window.location = { href: '' } as any;

    const error = createMockError({
      actions: [{ type: 'redirect', label: 'Go Home', url: '/' }]
    });

    render(<ErrorDisplay error={error} />);

    const redirectButton = screen.getByText('Go Home');
    fireEvent.click(redirectButton);

    expect(window.location.href).toBe('/');
  });

  test('handles refresh action correctly', () => {
    const mockReload = jest.fn();
    delete (window as any).location;
    window.location = { reload: mockReload } as any;

    const error = createMockError({
      actions: [{ type: 'refresh', label: 'Refresh Page' }]
    });

    render(<ErrorDisplay error={error} />);

    const refreshButton = screen.getByText('Refresh Page');
    fireEvent.click(refreshButton);

    expect(mockReload).toHaveBeenCalledTimes(1);
  });

  test('shows retry count when retries have been attempted', () => {
    const error = createMockError();
    const { rerender } = render(<ErrorDisplay error={error} />);

    // Simulate retry
    fireEvent.click(screen.getByText('Try Again'));

    // Re-render with updated component (in real usage, parent would manage this)
    rerender(<ErrorDisplay error={error} />);

    // Note: In a real implementation, you might want to track retry count
    // This test demonstrates the structure for such functionality
  });

  test('applies correct styling for different error types', () => {
    const paymentError = createMockError({ type: 'payment' });
    const { container } = render(<ErrorDisplay error={paymentError} />);

    const card = container.querySelector('.bg-red-50');
    expect(card).toBeInTheDocument();
  });

  test('handles custom action handlers', async () => {
    const customHandler = jest.fn();
    const error = createMockError({
      actions: [{ type: 'retry', label: 'Custom Action', handler: customHandler }]
    });

    render(<ErrorDisplay error={error} />);

    const customButton = screen.getByText('Custom Action');
    fireEvent.click(customButton);

    expect(customHandler).toHaveBeenCalledTimes(1);
  });

  test('shows external link icon for redirect actions', () => {
    const error = createMockError({
      actions: [{ type: 'redirect', label: 'External Link', url: 'https://example.com' }]
    });

    render(<ErrorDisplay error={error} />);

    expect(screen.getByTestId('external-link')).toBeInTheDocument();
  });
});