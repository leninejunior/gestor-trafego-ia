import { Request, Response, NextFunction } from 'express';
import { WebhookPayloadSchema } from '../../domain/validation/schemas';
import { Logger } from '../logging/logger';
import { MetricsService } from '../monitoring/metrics.service';
import { ProviderRegistry } from '../../domain/services/provider-registry';
import { WebhookSecurityService } from '../../domain/services/webhook-security';

export class WebhookController {
  private logger = Logger.getInstance();
  private metricsService = MetricsService.getInstance();

  constructor(
    private providerRegistry: ProviderRegistry,
    private webhookSecurity: WebhookSecurityService
  ) {}

  /**
   * POST /api/v1/webhooks/:providerName
   * Receive webhook events from payment providers
   */
  async receiveWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const { providerName } = req.params;
    
    try {
      this.logger.info('Webhook received', {
        correlationId: req.correlationId,
        providerName,
        contentType: req.get('content-type'),
        userAgent: req.get('user-agent')
      });

      // Get provider
      const provider = this.providerRegistry.getProvider(providerName);
      if (!provider) {
        res.status(404).json({
          success: false,
          error: 'Provider not found',
          correlationId: req.correlationId
        });
        return;
      }

      // Get raw body and signature
      const rawBody = req.body;
      const signature = req.get('x-signature') || req.get('stripe-signature') || req.get('authorization');

      if (!signature) {
        this.logger.warn('Webhook signature missing', {
          correlationId: req.correlationId,
          providerName
        });
        
        res.status(400).json({
          success: false,
          error: 'Webhook signature required',
          correlationId: req.correlationId
        });
        return;
      }

      // Validate webhook signature
      const isValid = await this.webhookSecurity.validateWebhookSignature(
        providerName,
        rawBody,
        signature
      );

      if (!isValid) {
        this.logger.warn('Invalid webhook signature', {
          correlationId: req.correlationId,
          providerName
        });
        
        res.status(401).json({
          success: false,
          error: 'Invalid webhook signature',
          correlationId: req.correlationId
        });
        return;
      }

      // Parse webhook event
      const webhookEvent = provider.parseWebhook(rawBody);
      
      // Validate webhook payload structure
      const validatedPayload = WebhookPayloadSchema.parse({
        ...webhookEvent,
        provider: providerName
      });

      this.logger.info('Webhook validated successfully', {
        correlationId: req.correlationId,
        providerName,
        eventType: validatedPayload.type,
        eventId: validatedPayload.id
      });

      // Process webhook event
      await this.processWebhookEvent(validatedPayload, req.correlationId);

      // Record metrics
      const duration = Date.now() - startTime;
      this.metricsService.recordWebhookProcessed(providerName, 'success', duration);

      // Respond to provider
      res.status(200).json({
        success: true,
        message: 'Webhook processed successfully',
        eventId: validatedPayload.id,
        correlationId: req.correlationId
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      this.metricsService.recordWebhookProcessed(providerName, 'failed', duration);
      
      this.logger.error('Webhook processing failed', {
        correlationId: req.correlationId,
        providerName,
        error: error instanceof Error ? error.message : error
      });

      // Always respond with 200 to prevent provider retries for validation errors
      if (error instanceof Error && error.message.includes('validation')) {
        res.status(200).json({
          success: false,
          error: 'Webhook validation failed',
          correlationId: req.correlationId
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Webhook processing failed',
          correlationId: req.correlationId
        });
      }
    }
  }

  /**
   * GET /api/v1/webhooks/events
   * List webhook events (for debugging)
   */
  async listWebhookEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { providerName, eventType, limit = 50, offset = 0 } = req.query;

      this.logger.info('Listing webhook events', {
        correlationId: req.correlationId,
        providerName,
        eventType,
        limit,
        offset
      });

      // TODO: Implement webhook event listing from database
      // const events = await this.webhookEventService.listEvents({
      //   providerName,
      //   eventType,
      //   limit: Number(limit),
      //   offset: Number(offset)
      // });

      // For now, return placeholder data
      const events = [
        {
          id: 'evt_1',
          type: 'payment.succeeded',
          provider: 'stripe',
          data: { paymentId: 'pay_123' },
          processedAt: new Date(),
          status: 'processed'
        }
      ];

      res.json({
        success: true,
        data: events,
        count: events.length,
        correlationId: req.correlationId
      });

    } catch (error) {
      this.logger.error('Webhook events listing failed', {
        correlationId: req.correlationId,
        error: error instanceof Error ? error.message : error
      });
      
      next(error);
    }
  }

  /**
   * POST /api/v1/webhooks/retry/:eventId
   * Retry failed webhook event processing
   */
  async retryWebhookEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { eventId } = req.params;

      this.logger.info('Retrying webhook event', {
        correlationId: req.correlationId,
        eventId
      });

      // TODO: Implement webhook retry logic
      // const result = await this.webhookEventService.retryEvent(eventId);

      // For now, return placeholder response
      const result = {
        eventId,
        status: 'retried',
        retriedAt: new Date()
      };

      res.json({
        success: true,
        data: result,
        correlationId: req.correlationId
      });

    } catch (error) {
      this.logger.error('Webhook retry failed', {
        correlationId: req.correlationId,
        eventId: req.params.eventId,
        error: error instanceof Error ? error.message : error
      });
      
      next(error);
    }
  }

  /**
   * Process webhook event based on type
   */
  private async processWebhookEvent(event: any, correlationId?: string): Promise<void> {
    try {
      switch (event.type) {
        case 'payment.succeeded':
        case 'payment_intent.succeeded':
          await this.handlePaymentSucceeded(event, correlationId);
          break;
          
        case 'payment.failed':
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(event, correlationId);
          break;
          
        case 'subscription.created':
        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event, correlationId);
          break;
          
        case 'subscription.updated':
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event, correlationId);
          break;
          
        case 'subscription.canceled':
        case 'customer.subscription.deleted':
          await this.handleSubscriptionCanceled(event, correlationId);
          break;
          
        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSucceeded(event, correlationId);
          break;
          
        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event, correlationId);
          break;
          
        default:
          this.logger.warn('Unhandled webhook event type', {
            correlationId,
            eventType: event.type,
            eventId: event.id
          });
      }
    } catch (error) {
      this.logger.error('Webhook event processing failed', {
        correlationId,
        eventType: event.type,
        eventId: event.id,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  private async handlePaymentSucceeded(event: any, correlationId?: string): Promise<void> {
    this.logger.info('Processing payment succeeded event', {
      correlationId,
      eventId: event.id,
      paymentId: event.data.id
    });
    
    // TODO: Update payment status in database
    // TODO: Notify main application via webhook
  }

  private async handlePaymentFailed(event: any, correlationId?: string): Promise<void> {
    this.logger.info('Processing payment failed event', {
      correlationId,
      eventId: event.id,
      paymentId: event.data.id
    });
    
    // TODO: Update payment status in database
    // TODO: Notify main application via webhook
  }

  private async handleSubscriptionCreated(event: any, correlationId?: string): Promise<void> {
    this.logger.info('Processing subscription created event', {
      correlationId,
      eventId: event.id,
      subscriptionId: event.data.id
    });
    
    // TODO: Update subscription status in database
    // TODO: Notify main application via webhook
  }

  private async handleSubscriptionUpdated(event: any, correlationId?: string): Promise<void> {
    this.logger.info('Processing subscription updated event', {
      correlationId,
      eventId: event.id,
      subscriptionId: event.data.id
    });
    
    // TODO: Update subscription in database
    // TODO: Notify main application via webhook
  }

  private async handleSubscriptionCanceled(event: any, correlationId?: string): Promise<void> {
    this.logger.info('Processing subscription canceled event', {
      correlationId,
      eventId: event.id,
      subscriptionId: event.data.id
    });
    
    // TODO: Update subscription status in database
    // TODO: Notify main application via webhook
  }

  private async handleInvoicePaymentSucceeded(event: any, correlationId?: string): Promise<void> {
    this.logger.info('Processing invoice payment succeeded event', {
      correlationId,
      eventId: event.id,
      invoiceId: event.data.id
    });
    
    // TODO: Update invoice status in database
    // TODO: Notify main application via webhook
  }

  private async handleInvoicePaymentFailed(event: any, correlationId?: string): Promise<void> {
    this.logger.info('Processing invoice payment failed event', {
      correlationId,
      eventId: event.id,
      invoiceId: event.data.id
    });
    
    // TODO: Update invoice status in database
    // TODO: Notify main application via webhook
  }
}