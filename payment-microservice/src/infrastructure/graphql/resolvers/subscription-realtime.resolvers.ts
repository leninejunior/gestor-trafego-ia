import { PubSub } from 'apollo-server-express';
import { Logger } from '../../logging/logger';

const logger = Logger.getInstance();
const pubsub = new PubSub();

// Event types for real-time subscriptions
export const EVENTS = {
  PAYMENT_STATUS_CHANGED: 'PAYMENT_STATUS_CHANGED',
  SUBSCRIPTION_STATUS_CHANGED: 'SUBSCRIPTION_STATUS_CHANGED',
  PROVIDER_HEALTH_CHANGED: 'PROVIDER_HEALTH_CHANGED',
  TRANSACTION_UPDATED: 'TRANSACTION_UPDATED'
};

export const subscriptionResolvers = {
  Subscription: {
    paymentStatusChanged: {
      subscribe: (_: any, { organizationId }: { organizationId: string }) => {
        logger.info('Client subscribed to payment status changes', { organizationId });
        return pubsub.asyncIterator([`${EVENTS.PAYMENT_STATUS_CHANGED}_${organizationId}`]);
      }
    },

    subscriptionStatusChanged: {
      subscribe: (_: any, { organizationId }: { organizationId: string }) => {
        logger.info('Client subscribed to subscription status changes', { organizationId });
        return pubsub.asyncIterator([`${EVENTS.SUBSCRIPTION_STATUS_CHANGED}_${organizationId}`]);
      }
    },

    providerHealthChanged: {
      subscribe: () => {
        logger.info('Client subscribed to provider health changes');
        return pubsub.asyncIterator([EVENTS.PROVIDER_HEALTH_CHANGED]);
      }
    },

    transactionUpdated: {
      subscribe: (_: any, { organizationId }: { organizationId: string }) => {
        logger.info('Client subscribed to transaction updates', { organizationId });
        return pubsub.asyncIterator([`${EVENTS.TRANSACTION_UPDATED}_${organizationId}`]);
      }
    }
  }
};

// Helper functions to publish events
export const publishPaymentStatusChanged = (organizationId: string, payment: any) => {
  pubsub.publish(`${EVENTS.PAYMENT_STATUS_CHANGED}_${organizationId}`, {
    paymentStatusChanged: payment
  });
};

export const publishSubscriptionStatusChanged = (organizationId: string, subscription: any) => {
  pubsub.publish(`${EVENTS.SUBSCRIPTION_STATUS_CHANGED}_${organizationId}`, {
    subscriptionStatusChanged: subscription
  });
};

export const publishProviderHealthChanged = (provider: any) => {
  pubsub.publish(EVENTS.PROVIDER_HEALTH_CHANGED, {
    providerHealthChanged: provider
  });
};

export const publishTransactionUpdated = (organizationId: string, transaction: any) => {
  pubsub.publish(`${EVENTS.TRANSACTION_UPDATED}_${organizationId}`, {
    transactionUpdated: transaction
  });
};

// Export pubsub for use in other parts of the application
export { pubsub };