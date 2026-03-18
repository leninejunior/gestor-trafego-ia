import { Router } from 'express';
import { paymentRoutes } from './payment.routes';
import { subscriptionRoutes } from './subscription.routes';
import { providerRoutes } from './provider.routes';
import { webhookRoutes } from './webhook.routes';
import { adminRoutes } from './admin.routes';

const router = Router();

/**
 * API v1 Routes
 * Base path: /api/v1
 */

// Payment operations
router.use('/payments', paymentRoutes);

// Subscription operations
router.use('/subscriptions', subscriptionRoutes);

// Provider management
router.use('/providers', providerRoutes);

// Webhook handling
router.use('/webhooks', webhookRoutes);

// Admin operations (requires authentication)
router.use('/admin', adminRoutes);

// API version info
router.get('/', (req, res) => {
  res.json({
    version: 'v1',
    name: 'Payment Microservice API',
    description: 'Multi-provider payment processing API',
    endpoints: {
      payments: '/api/v1/payments',
      subscriptions: '/api/v1/subscriptions',
      providers: '/api/v1/providers',
      webhooks: '/api/v1/webhooks',
      admin: '/api/v1/admin'
    },
    documentation: '/api/v1/docs',
    health: '/health',
    metrics: '/metrics'
  });
});

export { router as v1Router };