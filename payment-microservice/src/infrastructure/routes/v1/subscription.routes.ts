import { Router } from 'express';
import { SubscriptionController } from '../../controllers/subscription.controller';

const router = Router();

// Create subscription controller instance
const subscriptionController = new SubscriptionController();

/**
 * Subscription Routes - API v1
 */

// Create subscription
router.post('/', subscriptionController.createSubscription.bind(subscriptionController));

// Get subscription by ID
router.get('/:id', subscriptionController.getSubscription.bind(subscriptionController));

// List subscriptions for organization
router.get('/', subscriptionController.listSubscriptions.bind(subscriptionController));

// Update subscription
router.put('/:id', subscriptionController.updateSubscription.bind(subscriptionController));

// Cancel subscription
router.delete('/:id', subscriptionController.cancelSubscription.bind(subscriptionController));

export { router as subscriptionRoutes };