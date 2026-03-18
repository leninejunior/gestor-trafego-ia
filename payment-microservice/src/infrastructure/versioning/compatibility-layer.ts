import { Request, Response, NextFunction } from 'express';
import { Logger } from '../logging/logger';

interface V1PaymentRequest {
  amount: number;
  currency: string;
  payment_method: string;
  customer_id?: string;
  description?: string;
  return_url?: string;
  cancel_url?: string;
}

interface V2PaymentRequest {
  amount: number;
  currency: string;
  paymentMethod: string;
  organizationId: string;
  customerId?: string;
  description?: string;
  returnUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, any>;
}

interface V1PaymentResponse {
  payment_id: string;
  status_code: string;
  created_date: string;
  amount: number;
  currency: string;
}

interface V2PaymentResponse {
  id: string;
  status: string;
  createdAt: string;
  amount: number;
  currency: string;
  organizationId: string;
  metadata?: Record<string, any>;
}

export class CompatibilityLayer {
  private static instance: CompatibilityLayer;
  private logger = Logger.getInstance();

  private constructor() {}

  public static getInstance(): CompatibilityLayer {
    if (!CompatibilityLayer.instance) {
      CompatibilityLayer.instance = new CompatibilityLayer();
    }
    return CompatibilityLayer.instance;
  }

  // Transform v1 request to v2 format
  public transformV1ToV2Request(v1Request: V1PaymentRequest, organizationId: string): V2PaymentRequest {
    const v2Request: V2PaymentRequest = {
      amount: v1Request.amount,
      currency: v1Request.currency,
      paymentMethod: v1Request.payment_method,
      organizationId: organizationId,
      customerId: v1Request.customer_id,
      description: v1Request.description,
      returnUrl: v1Request.return_url,
      cancelUrl: v1Request.cancel_url
    };

    this.logger.debug('Transformed v1 request to v2', { v1Request, v2Request });
    return v2Request;
  }

  // Transform v2 response to v1 format
  public transformV2ToV1Response(v2Response: V2PaymentResponse): V1PaymentResponse {
    const v1Response: V1PaymentResponse = {
      payment_id: v2Response.id,
      status_code: v2Response.status,
      created_date: v2Response.createdAt,
      amount: v2Response.amount,
      currency: v2Response.currency
    };

    this.logger.debug('Transformed v2 response to v1', { v2Response, v1Response });
    return v1Response;
  }

  // Transform v1 subscription request to v2 format
  public transformV1SubscriptionToV2(v1Sub: any, organizationId: string): any {
    return {
      customerId: v1Sub.customer_id,
      planId: v1Sub.plan_id,
      organizationId: organizationId,
      trialDays: v1Sub.trial_days,
      metadata: v1Sub.metadata || {}
    };
  }

  // Transform v2 subscription response to v1 format
  public transformV2SubscriptionToV1(v2Sub: any): any {
    return {
      subscription_id: v2Sub.id,
      customer_id: v2Sub.customerId,
      plan_id: v2Sub.planId,
      status_code: v2Sub.status,
      created_date: v2Sub.createdAt,
      current_period_start: v2Sub.currentPeriodStart,
      current_period_end: v2Sub.currentPeriodEnd
    };
  }

  // Get organization ID from v1 request context
  private getOrganizationIdFromContext(req: Request): string {
    // In v1, organization ID might come from JWT token or header
    const orgId = req.headers['x-organization-id'] as string || 
                  req.user?.organizationId || 
                  'default-org'; // fallback for legacy clients
    
    return orgId;
  }
}

// Middleware for v1 compatibility
export const v1CompatibilityMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.path.startsWith('/api/v1/')) {
    return next();
  }

  const compatibility = CompatibilityLayer.getInstance();
  
  // Transform request body for v1 endpoints
  if (req.method === 'POST' || req.method === 'PUT') {
    const organizationId = req.headers['x-organization-id'] as string || 'default-org';
    
    if (req.path.includes('/payments')) {
      req.body = compatibility.transformV1ToV2Request(req.body, organizationId);
    } else if (req.path.includes('/subscriptions')) {
      req.body = compatibility.transformV1SubscriptionToV2(req.body, organizationId);
    }
  }

  // Intercept response to transform back to v1 format
  const originalSend = res.send;
  res.send = function(data: any) {
    try {
      if (typeof data === 'string') {
        data = JSON.parse(data);
      }

      if (req.path.includes('/payments') && data.id) {
        data = compatibility.transformV2ToV1Response(data);
      } else if (req.path.includes('/subscriptions') && data.id) {
        data = compatibility.transformV2SubscriptionToV1(data);
      }

      return originalSend.call(this, JSON.stringify(data));
    } catch (error) {
      return originalSend.call(this, data);
    }
  };

  next();
};

// Error response compatibility
export const transformErrorResponse = (error: any, version: string): any => {
  if (version === 'v1') {
    return {
      error_code: error.code || 'UNKNOWN_ERROR',
      error_message: error.message,
      error_details: error.details
    };
  }

  return {
    error: {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message,
      details: error.details,
      timestamp: new Date().toISOString()
    }
  };
};