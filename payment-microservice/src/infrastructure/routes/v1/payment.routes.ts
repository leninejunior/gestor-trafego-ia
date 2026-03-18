import { Router } from 'express';
import { PaymentController } from '../../controllers/payment.controller';
import { PaymentService } from '../../../application/services/payment.service';
import { container } from '../../container/container';

const router = Router();

// Get dependencies from container
const paymentService = container.get<PaymentService>('PaymentService');
const paymentController = new PaymentController(paymentService);

/**
 * Payment Routes - API v1
 */

// Create payment
router.post('/', paymentController.createPayment.bind(paymentController));

// Get payment by ID
router.get('/:id', paymentController.getPayment.bind(paymentController));

// List payments for organization
router.get('/', paymentController.listPayments.bind(paymentController));

// Refund payment
router.post('/:id/refund', paymentController.refundPayment.bind(paymentController));

// Capture payment
router.post('/:id/capture', paymentController.capturePayment.bind(paymentController));

export { router as paymentRoutes };