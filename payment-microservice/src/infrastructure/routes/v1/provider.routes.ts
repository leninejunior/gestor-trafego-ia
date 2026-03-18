import { Router } from 'express';
import { ProviderController } from '../../controllers/provider.controller';
import { ProviderRegistry } from '../../../domain/services/provider-registry';
import { HealthChecker } from '../../../domain/services/health-checker';
import { container } from '../../container/container';

const router = Router();

// Get dependencies from container
const providerRegistry = container.get<ProviderRegistry>('ProviderRegistry');
const healthChecker = container.get<HealthChecker>('HealthChecker');
const providerController = new ProviderController(providerRegistry, healthChecker);

/**
 * Provider Routes - API v1
 */

// List all providers
router.get('/', providerController.listProviders.bind(providerController));

// Get providers status
router.get('/status', providerController.getProvidersStatus.bind(providerController));

// Get provider details
router.get('/:name', providerController.getProvider.bind(providerController));

// Configure provider
router.post('/:name/configure', providerController.configureProvider.bind(providerController));

// Check provider health
router.get('/:name/health', providerController.checkProviderHealth.bind(providerController));

// Test provider
router.post('/:name/test', providerController.testProvider.bind(providerController));

export { router as providerRoutes };