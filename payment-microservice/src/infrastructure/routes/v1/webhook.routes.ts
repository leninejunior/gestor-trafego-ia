import { Router } from 'express';
import { WebhookController } from '../../controllers/webhook.controller';
import { ProviderRegistry } from '../../../domain/services/provider-registry';
import { WebhookSecurityService } from '../../../domain/services/webhook-security';
import { container } from '../../container/container';

const router = Router();

// Get dependencies from container
const providerRegistry = container.get<ProviderRegistry>('ProviderRegistry');
const webhookSecurity = container.get<WebhookSecurityService>('WebhookSecurityService');
const webhookController = new WebhookController(providerRegistry, webhookSecurity);

/**
 * Webhook Routes - API v1
 */

// Receive webhook from provider
router.post('/:providerName', webhookController.receiveWebhook.bind(webhookController));

// List webhook events (for debugging)
router.get('/events', webhookController.listWebhookEvents.bind(webhookController));

// Retry webhook event
router.post('/retry/:eventId', webhookController.retryWebhookEvent.bind(webhookController));

export { router as webhookRoutes };