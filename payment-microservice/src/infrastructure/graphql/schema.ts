import { gql } from 'apollo-server-express';

export const typeDefs = gql`
  # Scalars
  scalar DateTime
  scalar JSON

  # Enums
  enum PaymentStatus {
    PENDING
    PROCESSING
    SUCCEEDED
    FAILED
    CANCELED
    REQUIRES_ACTION
  }

  enum PaymentMethod {
    CREDIT_CARD
    DEBIT_CARD
    PIX
    BOLETO
    BANK_TRANSFER
  }

  enum Currency {
    BRL
    USD
    EUR
  }

  enum SubscriptionStatus {
    ACTIVE
    CANCELED
    PAST_DUE
    UNPAID
    TRIALING
    INCOMPLETE
  }

  enum BillingInterval {
    MONTHLY
    YEARLY
    WEEKLY
    DAILY
  }

  enum ProviderStatus {
    HEALTHY
    DEGRADED
    UNHEALTHY
    OFFLINE
  }

  # Types
  type Payment {
    id: ID!
    providerPaymentId: String!
    organizationId: String!
    customerId: String
    amount: Int!
    currency: Currency!
    status: PaymentStatus!
    description: String
    metadata: JSON
    createdAt: DateTime!
    updatedAt: DateTime!
    completedAt: DateTime
    failureReason: String
    provider: Provider
  }

  type Subscription {
    id: ID!
    providerSubscriptionId: String!
    organizationId: String!
    customerId: String!
    planId: String!
    amount: Int!
    currency: Currency!
    status: SubscriptionStatus!
    billingInterval: BillingInterval!
    startDate: DateTime!
    currentPeriodEnd: DateTime!
    canceledAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!
    provider: Provider
  }

  type Provider {
    name: String!
    version: String!
    isActive: Boolean!
    priority: Int!
    healthStatus: HealthStatus
    metrics: ProviderMetrics
  }

  type HealthStatus {
    status: ProviderStatus!
    responseTime: Int
    errorRate: Float
    lastCheck: DateTime!
    details: JSON
  }

  type ProviderMetrics {
    totalTransactions: Int!
    successfulTransactions: Int!
    successRate: Float!
    averageResponseTime: Float!
    period: MetricsPeriod!
  }

  type MetricsPeriod {
    start: DateTime!
    end: DateTime!
  }

  type Transaction {
    id: ID!
    organizationId: String!
    providerName: String!
    providerTransactionId: String
    type: String!
    status: String!
    amount: Int!
    currency: String!
    metadata: JSON
    createdAt: DateTime!
    updatedAt: DateTime!
    completedAt: DateTime
    failureReason: String
  }

  # Input Types
  input PaymentInput {
    amount: Int!
    currency: Currency!
    organizationId: String!
    customerId: String
    paymentMethodId: String
    description: String
    metadata: JSON
    returnUrl: String
    cancelUrl: String
    preferredMethod: PaymentMethod
  }

  input SubscriptionInput {
    customerId: String!
    organizationId: String!
    planId: String!
    amount: Int!
    currency: String!
    billingInterval: BillingInterval!
    trialPeriodDays: Int
    metadata: JSON
  }

  input SubscriptionUpdateInput {
    amount: Int
    planId: String
    metadata: JSON
    cancelAtPeriodEnd: Boolean
  }

  input PaymentFilter {
    organizationId: String
    customerId: String
    status: PaymentStatus
    currency: Currency
    dateFrom: DateTime
    dateTo: DateTime
    amountMin: Int
    amountMax: Int
  }

  input SubscriptionFilter {
    organizationId: String
    customerId: String
    status: SubscriptionStatus
    planId: String
    dateFrom: DateTime
    dateTo: DateTime
  }

  input TransactionFilter {
    organizationId: String
    providerName: String
    type: String
    status: String
    dateFrom: DateTime
    dateTo: DateTime
  }

  # Pagination
  input PaginationInput {
    limit: Int = 20
    offset: Int = 0
    orderBy: String = "createdAt"
    orderDirection: String = "DESC"
  }

  type PaginationInfo {
    total: Int!
    limit: Int!
    offset: Int!
    hasNext: Boolean!
    hasPrevious: Boolean!
  }

  # Response Types
  type PaymentConnection {
    payments: [Payment!]!
    pagination: PaginationInfo!
  }

  type SubscriptionConnection {
    subscriptions: [Subscription!]!
    pagination: PaginationInfo!
  }

  type TransactionConnection {
    transactions: [Transaction!]!
    pagination: PaginationInfo!
  }

  # Queries
  type Query {
    # Payment queries
    payment(id: ID!): Payment
    payments(filter: PaymentFilter, pagination: PaginationInput): PaymentConnection!
    
    # Subscription queries
    subscription(id: ID!): Subscription
    subscriptions(filter: SubscriptionFilter, pagination: PaginationInput): SubscriptionConnection!
    
    # Transaction queries
    transaction(id: ID!): Transaction
    transactions(filter: TransactionFilter, pagination: PaginationInput): TransactionConnection!
    
    # Provider queries
    providers: [Provider!]!
    provider(name: String!): Provider
    
    # Analytics queries
    paymentAnalytics(
      organizationId: String!
      dateFrom: DateTime!
      dateTo: DateTime!
      groupBy: String = "day"
    ): JSON!
    
    providerAnalytics(
      providerName: String
      dateFrom: DateTime!
      dateTo: DateTime!
    ): JSON!
  }

  # Mutations
  type Mutation {
    # Payment mutations
    createPayment(input: PaymentInput!): Payment!
    refundPayment(id: ID!, amount: Int, reason: String): Payment!
    capturePayment(id: ID!, amount: Int): Payment!
    
    # Subscription mutations
    createSubscription(input: SubscriptionInput!): Subscription!
    updateSubscription(id: ID!, input: SubscriptionUpdateInput!): Subscription!
    cancelSubscription(id: ID!, cancelAtPeriodEnd: Boolean = true): Subscription!
    
    # Provider mutations
    configureProvider(
      name: String!
      credentials: JSON!
      settings: JSON
      isActive: Boolean = true
      priority: Int = 0
    ): Provider!
    
    testProvider(name: String!, testAmount: Int = 100, currency: Currency = BRL): JSON!
  }

  # Subscriptions (Real-time updates)
  type Subscription {
    # Payment status updates
    paymentStatusChanged(organizationId: String!): Payment!
    
    # Subscription status updates
    subscriptionStatusChanged(organizationId: String!): Subscription!
    
    # Provider health updates
    providerHealthChanged: Provider!
    
    # Transaction updates
    transactionUpdated(organizationId: String!): Transaction!
  }
`;