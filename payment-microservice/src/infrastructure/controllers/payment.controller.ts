import { Request, Response, NextFunction } from 'express';
import { PaymentService } from '../../application/services/payment.service';
import { PaymentRequestSchema, RefundRequestSchema, ProcessingOptionsSchema } from '../../domain/validation/schemas';
import { Logger } from '../logging/logger';
import { MetricsService } from '../monitoring/metrics.service';

export class PaymentController {
  private logger = Logger.getInstance();
  private metricsService = MetricsService.getInstance();

  constructor(private paymentService: PaymentService) {}

  /**
   * POST /api/v1/payments
   * Create a new payment
   */
  async createPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Validate request body
      const validatedRequest = PaymentRequestSchema.parse(req.body);
      const processingOptions = ProcessingOptionsSchema.parse(req.query);

      this.logger.info('Creating payment', {
        correlationId: req.correlationId,
        organizationId: validatedRequest.organizationId,
        amount: validatedRequest.amount,
        currency: validatedRequest.currency
      });

      // Process payment
      const result = await this.paymentService.processPayment(
        validatedRequest,
        processingOptions.preferredProvider
      );

      // Record metrics
      const duration = Date.now() - startTime;
      this.metricsService.recordPaymentProcessed(result.status, duration);

      res.status(201).json({
        success: true,
        data: result,
        correlationId: req.correlationId
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      this.metricsService.recordPaymentProcessed('failed', duration);
      
      this.logger.error('Payment creation failed', {
        correlationId: req.correlationId,
        error: error instanceof Error ? error.message : error
      });
      
      next(error);
    }
  }

  /**
   * GET /api/v1/payments/:id
   * Get payment by ID
   */
  async getPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      this.logger.info('Retrieving payment', {
        correlationId: req.correlationId,
        paymentId: id
      });

      const payment = await this.paymentService.getTransaction(id);

      if (!payment) {
        res.status(404).json({
          success: false,
          error: 'Payment not found',
          correlationId: req.correlationId
        });
        return;
      }

      res.json({
        success: true,
        data: payment,
        correlationId: req.correlationId
      });

    } catch (error) {
      this.logger.error('Payment retrieval failed', {
        correlationId: req.correlationId,
        paymentId: req.params.id,
        error: error instanceof Error ? error.message : error
      });
      
      next(error);
    }
  }

  /**
   * GET /api/v1/payments
   * List payments for organization
   */
  async listPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.query;

      if (!organizationId || typeof organizationId !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Organization ID is required',
          correlationId: req.correlationId
        });
        return;
      }

      this.logger.info('Listing payments', {
        correlationId: req.correlationId,
        organizationId
      });

      const payments = await this.paymentService.getTransactionsByOrganization(organizationId);

      res.json({
        success: true,
        data: payments,
        count: payments.length,
        correlationId: req.correlationId
      });

    } catch (error) {
      this.logger.error('Payment listing failed', {
        correlationId: req.correlationId,
        organizationId: req.query.organizationId,
        error: error instanceof Error ? error.message : error
      });
      
      next(error);
    }
  }

  /**
   * POST /api/v1/payments/:id/refund
   * Refund a payment
   */
  async refundPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { id } = req.params;
      const validatedRequest = RefundRequestSchema.parse({
        paymentId: id,
        ...req.body
      });

      this.logger.info('Processing refund', {
        correlationId: req.correlationId,
        paymentId: id,
        amount: validatedRequest.amount
      });

      // TODO: Implement refund logic in PaymentService
      // const result = await this.paymentService.refundPayment(validatedRequest);

      // For now, return a placeholder response
      const result = {
        id: `refund_${Date.now()}`,
        paymentId: id,
        amount: validatedRequest.amount,
        status: 'processing',
        createdAt: new Date()
      };

      const duration = Date.now() - startTime;
      this.metricsService.recordRefundProcessed('processing', duration);

      res.status(201).json({
        success: true,
        data: result,
        correlationId: req.correlationId
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      this.metricsService.recordRefundProcessed('failed', duration);
      
      this.logger.error('Refund processing failed', {
        correlationId: req.correlationId,
        paymentId: req.params.id,
        error: error instanceof Error ? error.message : error
      });
      
      next(error);
    }
  }

  /**
   * POST /api/v1/payments/:id/capture
   * Capture an authorized payment
   */
  async capturePayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { id } = req.params;
      const { amount } = req.body;

      this.logger.info('Capturing payment', {
        correlationId: req.correlationId,
        paymentId: id,
        amount
      });

      // TODO: Implement capture logic in PaymentService
      // const result = await this.paymentService.capturePayment(id, amount);

      // For now, return a placeholder response
      const result = {
        id,
        status: 'captured',
        amount,
        capturedAt: new Date()
      };

      const duration = Date.now() - startTime;
      this.metricsService.recordPaymentProcessed('captured', duration);

      res.json({
        success: true,
        data: result,
        correlationId: req.correlationId
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      this.metricsService.recordPaymentProcessed('failed', duration);
      
      this.logger.error('Payment capture failed', {
        correlationId: req.correlationId,
        paymentId: req.params.id,
        error: error instanceof Error ? error.message : error
      });
      
      next(error);
    }
  }
}