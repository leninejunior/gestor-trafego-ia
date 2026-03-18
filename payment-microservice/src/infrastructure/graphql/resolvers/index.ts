import { GraphQLDateTime, GraphQLJSON } from 'graphql-scalars';
import { paymentResolvers } from './payment.resolvers';
import { subscriptionResolvers } from './subscription.resolvers';
import { providerResolvers } from './provider.resolvers';
import { transactionResolvers } from './transaction.resolvers';
import { subscriptionResolvers as realtimeSubscriptionResolvers } from './subscription-realtime.resolvers';

export const resolvers = {
  // Scalar types
  DateTime: GraphQLDateTime,
  JSON: GraphQLJSON,

  // Query resolvers
  Query: {
    ...paymentResolvers.Query,
    ...subscriptionResolvers.Query,
    ...providerResolvers.Query,
    ...transactionResolvers.Query
  },

  // Mutation resolvers
  Mutation: {
    ...paymentResolvers.Mutation,
    ...subscriptionResolvers.Mutation,
    ...providerResolvers.Mutation
  },

  // Subscription resolvers (real-time)
  Subscription: {
    ...realtimeSubscriptionResolvers.Subscription
  },

  // Type resolvers
  Payment: paymentResolvers.Payment,
  Subscription: subscriptionResolvers.Subscription,
  Provider: providerResolvers.Provider
};