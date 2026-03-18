import { PaymentService } from '../../../application/services/payment.service';
import { Logger } from '../../logging/logger';
import { container } from '../../container/container';

const logger = Logger.getInstance();

export const paymentResolvers = {
  Query: {
    payment: async (_: any, { id }: { id: string }) => {
      try {
        const paymentService = container.get<PaymentService>('PaymentService');
        const payment = await paymentService.getTransaction(id);
        
        if (!payment) {
          throw new Error(`Payment with id ${id} not found`);
        }
        
        return payment;
      } catch (error) {
        logger.error('GraphQL payment query failed', { paymentId: id, error });
        throw error;
      }
    },

    payments: async (_: any, { filter, pagination }: any) => {
      try {
        const paymentService = container.get<PaymentService>('PaymentService');
        
        if (!filter?.organizationId) {
          throw new Error('Organization ID is required');
        }

        // TODO: Implement filtering and pagination in PaymentService
        const payments = await paymentService.getTransactionsByOrganization(filter.organizationId);
        
        // Apply client-side filtering for now (should be done in service/repository)
        let filteredPayments = payments;
        
        if (filter.status) {
          filteredPayments = filteredPayments.filter(p => p.status === filter.status);
        }
        
        if (filter.currency) {
          filteredPayments = filteredPayments.filter(p => p.currency === filter.currency);
        }
        
        if (filter.customerId) {
          filteredPayments = filteredPayments.filter(p => 
            p.metadata && p.metadata.customerId === filter.customerId
          );
        }

        // Apply pagination
        const limit = pagination?.limit || 20;
        const offset = pagination?.offset || 0;
        const total = filteredPayments.length;
        const paginatedPayments = filteredPayments.slice(offset, offset + limit);

        return {
          payments: paginatedPayments,
          pagination: {
            total,
            limit,
            offset,
            hasNext: offset + limit < total,
            hasPrevious: offset > 0
          }
        };
      } catch (error) {
        logger.error('GraphQL payments query failed', { filter, pagination, error });
        throw error;
      }
    }
  },

  Mutation: {
    createPayment: async (_: any, { input }: any) => {
      try {
        const paymentService = container.get<PaymentService>('PaymentService');
        
        // Convert GraphQL input to PaymentRequest
        const paymentRequest = {
          amount: input.amount,
          currency: input.currency,
          organizationId: input.organizationId,
          customerId: input.customerId,
          paymentMethodId: input.paymentMethodId,
          description: input.description,
          metadata: input.metadata,
          returnUrl: input.returnUrl,
          cancelUrl: input.cancelUrl,
          preferredMethod: input.preferredMethod
        };

        const result = await paymentService.processPayment(paymentRequest);
        
        // Convert PaymentResponse to GraphQL Payment type
        return {
          id: result.id,
          providerPaymentId: result.providerPaymentId,
          organizationId: paymentRequest.organizationId,
          customerId: paymentRequest.customerId,
          amount: result.amount,
          currency: result.currency,
          status: result.status,
          description: paymentRequest.description,
          metadata: paymentRequest.metadata,
          createdAt: result.createdAt,
          updatedAt: result.updatedAt
        };
      } catch (error) {
        logger.error('GraphQL createPayment mutation failed', { input, error });
        throw error;
      }
    },

    refundPayment: async (_: any, { id, amount, reason }: any) => {
      try {
        // TODO: Implement refund logic in PaymentService
        logger.info('GraphQL refundPayment mutation', { id, amount, reason });
        
        // Placeholder response
        return {
          id,
          status: 'PROCESSING',
          updatedAt: new Date()
        };
      } catch (error) {
        logger.error('GraphQL refundPayment mutation failed', { id, amount, reason, error });
        throw error;
      }
    },

    capturePayment: async (_: any, { id, amount }: any) => {
      try {
        // TODO: Implement capture logic in PaymentService
        logger.info('GraphQL capturePayment mutation', { id, amount });
        
        // Placeholder response
        return {
          id,
          status: 'SUCCEEDED',
          updatedAt: new Date()
        };
      } catch (error) {
        logger.error('GraphQL capturePayment mutation failed', { id, amount, error });
        throw error;
      }
    }
  },

  Payment: {
    provider: async (payment: any) => {
      try {
        // TODO: Load provider information
        return {
          name: payment.providerName || 'unknown',
          version: '1.0.0',
          isActive: true,
          priority: 0
        };
      } catch (error) {
        logger.error('GraphQL Payment.provider resolver failed', { payment, error });
        return null;
      }
    }
  }
};