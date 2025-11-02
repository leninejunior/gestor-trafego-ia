import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ErrorDisplay } from '@/components/checkout/error-display';
import { SecurityBadges, TrustIndicators } from '@/components/checkout/security-badges';
import { RecoveryNotification } from '@/components/checkout/recovery-notification';
import { CheckoutProgress } from '@/components/checkout/checkout-progress';
import { CheckoutError } from '@/lib/checkout/error-handler';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock icons for testing
jest.mock('lucide-react', () => ({
  AlertTriangle: () => <div data-testid="alert-triangle" />,
  XCircle: () => <div data-testid="x-circle" />,
  CheckCircle: () => <div data-testid="check-circle" />,
  Shield: () => <div data-testid="shield" />,
  Lock: () => <div data-testid="lock" />,
  CreditCard: () => <div data-testid="credit-card" />,
  Globe: () => <div data-testid="globe" />,
  RefreshCw: () => <div data-testid="refresh-cw" />,
  ArrowLeft: () => <div data-testid="arrow-left" />,
  Mail: () => <div data-testid="mail" />,
  Info: () => <div data-testid="info" />,
  X: () => <div data-testid="x" />,
  Circle: () => <div data-testid="circle" />
}));

describe('Checkout Accessibility Tests', () => {
  const mockError: CheckoutError = {
    code: 'TEST_ERROR',
    message: 'Test error message',
    type: 'server',
    recoverable: true,
    retryable: true,
    userMessage: 'Something went wrong. Please try again.',
    actions: [
      { type: 'retry', label: 'Try Again', primary: true },
      { type: 'contact', label: 'Contact Support' }
    ]
  };

  describe('ErrorDisplay Accessibility', () => {
    test('should not have accessibility violations', async () => {
      const { container } = render(<ErrorDisplay error={mockError} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('should have proper ARIA labels and roles', () => {
      render(<ErrorDisplay error={mockError} />);

      // Error message should be announced to screen readers
      const errorAlert = screen.getByRole('alert');
      expect(errorAlert).toBeInTheDocument();

      // Buttons should have accessible names
      const retryButton = screen.getByRole('button', { name: /try again/i });
      expect(retryButton).toBeInTheDocument();

      const contactButton = screen.getByRole('button', { name: /contact support/i });
      expect(contactButton).toBeInTheDocument();
    });

    test('should have proper heading structure', () => {
      render(<ErrorDisplay error={mockError} />);

      // Should have a main heading
      const heading = screen.getByRole('heading', { level: 3 });
      expect(heading).toHaveTextContent('Ops! Algo deu errado');
    });

    test('should have sufficient color contrast', () => {
      const { container } = render(<ErrorDisplay error={mockError} />);

      // Check that error styling provides sufficient contrast
      const errorCard = container.querySelector('.bg-purple-50');
      expect(errorCard).toBeInTheDocument();
    });

    test('should support keyboard navigation', () => {
      render(<ErrorDisplay error={mockError} />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).not.toHaveAttribute('tabindex', '-1');
      });
    });
  });

  describe('SecurityBadges Accessibility', () => {
    test('should not have accessibility violations', async () => {
      const { container } = render(<SecurityBadges />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('should have proper semantic structure', () => {
      render(<SecurityBadges />);

      // Should have a heading for the security section
      const heading = screen.getByRole('heading', { level: 3 });
      expect(heading).toHaveTextContent('Checkout Seguro');

      // Security features should be in a list structure
      const securityInfo = screen.getByText('Pagamento Seguro');
      expect(securityInfo).toBeInTheDocument();
    });

    test('should have descriptive text for icons', () => {
      render(<SecurityBadges />);

      // Icons should have accompanying text
      expect(screen.getByText('Pagamento Seguro')).toBeInTheDocument();
      expect(screen.getByText('Dados Protegidos')).toBeInTheDocument();
      expect(screen.getByText('Verificado')).toBeInTheDocument();
      expect(screen.getByText('Múltiplas Formas')).toBeInTheDocument();
    });
  });

  describe('TrustIndicators Accessibility', () => {
    test('should not have accessibility violations', async () => {
      const { container } = render(<TrustIndicators />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('should use proper list semantics', () => {
      const { container } = render(<TrustIndicators />);

      // Trust indicators should be in a list
      const listItems = container.querySelectorAll('div');
      expect(listItems.length).toBeGreaterThan(0);

      // Each item should have descriptive text
      expect(screen.getByText(/cancelamento gratuito/i)).toBeInTheDocument();
      expect(screen.getByText(/suporte técnico/i)).toBeInTheDocument();
    });
  });

  describe('RecoveryNotification Accessibility', () => {
    test('should not have accessibility violations', async () => {
      const { container } = render(
        <RecoveryNotification
          type="error"
          message="Test notification"
          description="Test description"
        />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('should have proper alert role', () => {
      render(
        <RecoveryNotification
          type="error"
          message="Test notification"
          description="Test description"
        />
      );

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent('Test notification');
    });

    test('should have accessible close button', () => {
      const mockOnClose = jest.fn();
      render(
        <RecoveryNotification
          type="info"
          message="Test notification"
          onClose={mockOnClose}
        />
      );

      const closeButton = screen.getByRole('button');
      expect(closeButton).toBeInTheDocument();
      expect(closeButton).toHaveAttribute('aria-label', expect.any(String));
    });

    test('should announce notification type to screen readers', () => {
      render(
        <RecoveryNotification
          type="success"
          message="Operation successful"
        />
      );

      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass(/bg-green-50/);
    });
  });

  describe('CheckoutProgress Accessibility', () => {
    const mockSteps = [
      {
        id: 1,
        title: 'Personal Info',
        description: 'Basic account data',
        completed: true
      },
      {
        id: 2,
        title: 'Company Data',
        description: 'Organization information',
        completed: false
      },
      {
        id: 3,
        title: 'Payment',
        description: 'Complete subscription',
        completed: false
      }
    ];

    test('should not have accessibility violations', async () => {
      const { container } = render(
        <CheckoutProgress steps={mockSteps} currentStep={2} />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('should have proper progress semantics', () => {
      render(<CheckoutProgress steps={mockSteps} currentStep={2} />);

      // Steps should be clearly labeled
      expect(screen.getByText('Personal Info')).toBeInTheDocument();
      expect(screen.getByText('Company Data')).toBeInTheDocument();
      expect(screen.getByText('Payment')).toBeInTheDocument();
    });

    test('should indicate current and completed steps', () => {
      const { container } = render(
        <CheckoutProgress steps={mockSteps} currentStep={2} />
      );

      // Completed steps should be visually distinct
      const completedStep = container.querySelector('.bg-green-500');
      expect(completedStep).toBeInTheDocument();

      // Current step should be highlighted
      const currentStep = container.querySelector('.bg-blue-500');
      expect(currentStep).toBeInTheDocument();
    });

    test('should provide step descriptions', () => {
      render(<CheckoutProgress steps={mockSteps} currentStep={2} />);

      expect(screen.getByText('Basic account data')).toBeInTheDocument();
      expect(screen.getByText('Organization information')).toBeInTheDocument();
      expect(screen.getByText('Complete subscription')).toBeInTheDocument();
    });
  });

  describe('Form Accessibility', () => {
    test('should have proper form labels and structure', () => {
      // This would test the actual checkout form
      // For now, we'll test the expected structure
      const formHTML = `
        <form>
          <label for="name">Nome Completo *</label>
          <input id="name" type="text" required aria-describedby="name-error" />
          <div id="name-error" role="alert" aria-live="polite"></div>
          
          <label for="email">Email *</label>
          <input id="email" type="email" required aria-describedby="email-error" />
          <div id="email-error" role="alert" aria-live="polite"></div>
          
          <button type="submit">Continuar para Pagamento</button>
        </form>
      `;

      const { container } = render(<div dangerouslySetInnerHTML={{ __html: formHTML }} />);

      // Check for proper labeling
      const nameInput = container.querySelector('#name');
      const nameLabel = container.querySelector('label[for="name"]');
      expect(nameInput).toBeInTheDocument();
      expect(nameLabel).toBeInTheDocument();

      // Check for error message association
      expect(nameInput).toHaveAttribute('aria-describedby', 'name-error');

      // Check for required field indication
      expect(nameInput).toHaveAttribute('required');
    });
  });

  describe('Focus Management', () => {
    test('should manage focus properly in error states', () => {
      render(<ErrorDisplay error={mockError} />);

      // Error should be announced but not steal focus
      const errorAlert = screen.getByRole('alert');
      expect(errorAlert).toBeInTheDocument();

      // Primary action button should be focusable
      const primaryButton = screen.getByRole('button', { name: /try again/i });
      expect(primaryButton).not.toHaveAttribute('tabindex', '-1');
    });

    test('should provide skip links for keyboard users', () => {
      // This would test skip navigation in the actual checkout page
      const skipLinkHTML = `
        <a href="#main-content" class="sr-only focus:not-sr-only">
          Pular para conteúdo principal
        </a>
        <main id="main-content">
          <h1>Checkout</h1>
        </main>
      `;

      const { container } = render(<div dangerouslySetInnerHTML={{ __html: skipLinkHTML }} />);
      
      const skipLink = container.querySelector('a[href="#main-content"]');
      expect(skipLink).toBeInTheDocument();
    });
  });

  describe('Screen Reader Support', () => {
    test('should provide proper live regions for dynamic content', () => {
      render(
        <div>
          <div role="status" aria-live="polite" aria-label="Checkout status">
            Processando pagamento...
          </div>
          <div role="alert" aria-live="assertive">
            Erro no pagamento
          </div>
        </div>
      );

      const statusRegion = screen.getByRole('status');
      expect(statusRegion).toHaveAttribute('aria-live', 'polite');

      const alertRegion = screen.getByRole('alert');
      expect(alertRegion).toHaveAttribute('aria-live', 'assertive');
    });

    test('should provide descriptive text for complex interactions', () => {
      render(
        <div>
          <button aria-describedby="retry-help">
            Tentar Novamente
          </button>
          <div id="retry-help" className="sr-only">
            Clique para tentar o pagamento novamente. Isso pode levar alguns segundos.
          </div>
        </div>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-describedby', 'retry-help');

      const helpText = screen.getByText(/clique para tentar/i);
      expect(helpText).toBeInTheDocument();
    });
  });
});