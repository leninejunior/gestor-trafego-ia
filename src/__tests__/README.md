# SaaS Subscription Plans Testing Suite

This directory contains comprehensive tests for the SaaS subscription plans system, covering unit tests, integration tests, and end-to-end tests.

## Test Structure

### Unit Tests (`src/lib/services/__tests__/`)
- **plan-manager.test.ts**: Tests for Plan Manager service including plan CRUD operations, proration calculations, and feature validation
- **feature-gate.test.ts**: Tests for Feature Gate service including access control, usage limits, and feature matrix management
- **billing-engine.test.ts**: Tests for Billing Engine including recurring billing, invoice generation, payment processing, and retry logic

### Integration Tests (`src/__tests__/integration/`)
- **subscription-signup.test.ts**: Tests complete subscription signup flow, plan upgrades/downgrades, and payment failure scenarios
- **webhook-processing.test.ts**: Tests Stripe webhook processing, payment events, and subscription lifecycle management

### End-to-End Tests (`src/__tests__/e2e/`)
- **subscription-portal.spec.ts**: Tests customer subscription portal functionality including plan display, upgrades, billing history, and payment methods
- **admin-panel.spec.ts**: Tests admin panel subscription management including analytics, plan management, and billing oversight
- **feature-gate.spec.ts**: Tests feature gate enforcement across different subscription plans and user journeys

## Test Coverage

### Core Services Tested
1. **Plan Manager**
   - Plan creation and validation
   - Proration calculations for upgrades/downgrades
   - Feature matrix management
   - Plan retrieval and filtering

2. **Feature Gate Service**
   - Feature access validation
   - Usage limit enforcement
   - Real-time feature checking
   - Plan-based restrictions

3. **Billing Engine**
   - Recurring billing processing
   - Invoice generation and management
   - Payment success/failure handling
   - Retry logic with exponential backoff
   - Proration calculations

### Integration Scenarios Tested
1. **Subscription Signup Flow**
   - Complete signup with payment
   - Trial subscription creation
   - Payment failure handling
   - Plan validation

2. **Plan Changes**
   - Upgrade with prorated billing
   - Downgrade with credit application
   - Immediate feature access updates

3. **Payment Processing**
   - Webhook event processing
   - Payment retry mechanisms
   - Subscription status updates
   - Dunning management

### User Journey Tests
1. **Customer Portal**
   - Current subscription display
   - Plan comparison and selection
   - Billing history access
   - Payment method management
   - Subscription cancellation

2. **Admin Management**
   - Subscription analytics dashboard
   - Individual subscription management
   - Plan creation and editing
   - Billing oversight and intervention

3. **Feature Enforcement**
   - Basic plan restrictions
   - Pro plan access levels
   - Trial subscription behavior
   - Expired subscription handling

## Running Tests

### Unit Tests
```bash
npm test                    # Run all Jest tests
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Run tests with coverage report
```

### Integration Tests
```bash
npm test -- --testPathPatterns="integration"
```

### End-to-End Tests
```bash
npm run test:e2e           # Run Playwright tests
npm run test:e2e:ui        # Run tests with UI mode
```

## Test Configuration

### Jest Configuration (`jest.config.js`)
- Next.js integration for proper module resolution
- TypeScript support
- Mock setup for Supabase and Stripe
- Coverage reporting configuration

### Playwright Configuration (`playwright.config.ts`)
- Multi-browser testing (Chrome, Firefox, Safari)
- Local development server integration
- Test reporting and tracing

## Mock Strategy

### External Services
- **Supabase**: Mocked database operations and authentication
- **Stripe**: Mocked payment processing and webhook events
- **Next.js**: Mocked routing and navigation

### Test Data
- Consistent mock data across all test files
- Realistic subscription and plan configurations
- Edge case scenarios (expired subscriptions, payment failures)

## Key Test Scenarios

### Payment Flows
- Successful subscription creation
- Payment method validation
- Retry logic for failed payments
- Webhook event processing
- Proration calculations

### Feature Access
- Plan-based feature restrictions
- Usage limit enforcement
- Trial subscription behavior
- Upgrade prompts and flows

### Admin Operations
- Subscription analytics and reporting
- Manual subscription adjustments
- Plan management and configuration
- Billing oversight and intervention

## Notes

- Tests use comprehensive mocking to avoid external dependencies
- Integration tests focus on service interactions
- E2E tests validate complete user workflows
- All tests include error handling and edge case scenarios
- Mock data is designed to be realistic and comprehensive

## Future Enhancements

- Add performance testing for billing operations
- Implement load testing for webhook processing
- Add accessibility testing for subscription portal
- Include security testing for payment flows
- Add visual regression testing for UI components