import { PaymentService } from '../application/services/payment.service';
import { IPaymentProvider, PaymentRequest, PaymentResponse } from '../domain/ports/payment-provider.port';
import { ITransactionRepository } from '../domain/ports/repositories.port';
import { TransactionEntity, TransactionStatus, TransactionType } from '../domain/entities/transaction';
import { Currency, PaymentStatus } from '../domain/types';

// Mock implementations
class MockTransactionRepository implements ITransactionRepository {
  private transactions = new Map<string, TransactionEntity>();

  async create(transaction: TransactionEntity): Promise<TransactionEntity> {
    this.transactions.set(transaction.id, transaction);
    return transaction;
  }

  async update(transaction: TransactionEntity): Promise<TransactionEntity> {
    this.transactions.set(transaction.id, transaction);
    return transaction;
  }

  async findById(id: string): Promise<TransactionEntity | null> {
    return this.transactions.get(id) || null;
  }

  async findByOrganizationId(organizationId: string): Promise<TransactionEntity[]> {
    return Array.from(this.transactions.values())
      .filter(t => t.organizationId === organizationId);
  }

  async findByProviderTransactionId(providerTransactionId: string): Promise<TransactionEntity | null> {
    return Array.from(this.transactions.values())
      .find(t => t.providerTransactionId === providerTransactionId) || null;
  }

  async delete(id: string): Promise<void> {
    this.transactions.delete(id);
  }

  clear(): void {
    this.transactions.clear();
  }
}

class MockPaymentProvider implements IPaymentProvider {
  constructor(
    public readonly name: string,
    public readonly version: string = '1.0.0',
    private shouldFail: boolean = false
  ) {}

  async configure(): Promise<void> {}
  async validateConfig(): Promise<boolean> { return true; }

  async createPayment(request: PaymentRequest): Promise<PaymentResponse> {
    if (this.shouldFail) {
      throw new Error('Payment failed');
    }

    return {
      id: 'payment_123',
      providerTransactionId: 'provider_tx_123',
      status: 'succeeded',
      amount: request.amount,
      currency: request.currency,
      metadata: request.metadata || {}
    };
  }

  async capturePayment(paymentId: string): Promise<PaymentResponse> { throw new Error('Not implemented'); }
  async refundPayment(): Promise<any> { throw new Error('Not implemented'); }
  async createSubscription(): Promise<any> { throw new Error('Not implemented'); }
  async updateSubscription(): Promise<any> { throw new Error('Not implemented'); }
  async cancelSubscription(): Promise<any> { throw new Error('Not implemented'); }
  validateWebhook(): boolean { return true; }
  parseWebhook(): any { return {}; }
  async healthCheck(): Promise<any> { return { status: 'healthy' }; }

  setFailure(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }
}

describe('PaymentService', () => {
  let paymentService: PaymentService;
  let mockRepository: MockTransactionRepository;
  let mockProvider: MockPaymentProvider;
  let providerRegistry: Map<string, IPaymentProvider>;

  beforeEach(() => {
    mockRepository = new MockTransactionRepository();
    mockProvider = new MockPaymentProvider('test-provider');
    providerRegistry = new Map();
    providerRegistry.set('test-provider', mockProvider);

    paymentService = new PaymentService(mockRepository, providerRegistry);
  });

  afterEach(() => {
    mockRepository.clear();
  });

  describe('processPayment', () => {
    it('should process payment successfully with specific provider', async () => {
      const request: PaymentRequest = {
        amount: 1000,
        currency: Currency.BRL,
        organizationId: 'org_123',
        description: 'Test payment'
      };

      const result = await paymentService.processPayment(request, 'test-provider');

      expect(result.id).toBe('payment_123');
      expect(result.status).toBe(PaymentStatus.SUCCEEDED);
      expect(result.amount).toBe(1000);
      expect(result.currency).toBe(Currency.BRL);

      // Verify transaction was created and updated
      const transactions = await paymentService.getTransactionsByOrganization('org_123');
      expect(transactions).toHaveLength(1);
      expect(transactions[0].status).toBe(TransactionStatus.COMPLETED);
      expect(transactions[0].providerName).toBe('test-provider');
    });

    it('should process payment successfully with auto provider selection', async () => {
      const request: PaymentRequest = {
        amount: 2000,
        currency: Currency.USD,
        organizationId: 'org_456'
      };

      const result = await paymentService.processPayment(request);

      expect(result.id).toBe('payment_123');
      expect(result.status).toBe(PaymentStatus.SUCCEEDED);

      const transactions = await paymentService.getTransactionsByOrganization('org_456');
      expect(transactions).toHaveLength(1);
      expect(transactions[0].status).toBe(TransactionStatus.COMPLETED);
    });

    it('should handle payment failure correctly', async () => {
      mockProvider.setFailure(true);

      const request: PaymentRequest = {
        amount: 1000,
        currency: Currency.BRL,
        organizationId: 'org_789'
      };

      await expect(paymentService.processPayment(request, 'test-provider'))
        .rejects.toThrow('Payment failed');

      // Verify transaction was marked as failed
      const transactions = await paymentService.getTransactionsByOrganization('org_789');
      expect(transactions).toHaveLength(1);
      expect(transactions[0].status).toBe(TransactionStatus.FAILED);
      expect(transactions[0].failureReason).toBe('Payment failed');
      expect(transactions[0].completedAt).toBeDefined();
    });

    it('should throw error when no provider is available', async () => {
      const emptyRegistry = new Map<string, IPaymentProvider>();
      const serviceWithoutProviders = new PaymentService(mockRepository, emptyRegistry);

      const request: PaymentRequest = {
        amount: 1000,
        currency: Currency.BRL,
        organizationId: 'org_123'
      };

      await expect(serviceWithoutProviders.processPayment(request))
        .rejects.toThrow('No payment provider available');
    });

    it('should throw error when specific provider is not found', async () => {
      const request: PaymentRequest = {
        amount: 1000,
        currency: Currency.BRL,
        organizationId: 'org_123'
      };

      await expect(paymentService.processPayment(request, 'non-existent-provider'))
        .rejects.toThrow('No payment provider available');
    });

    it('should create transaction with correct metadata', async () => {
      const request: PaymentRequest = {
        amount: 1500,
        currency: Currency.EUR,
        organizationId: 'org_metadata',
        metadata: {
          orderId: 'order_123',
          customField: 'custom_value'
        }
      };

      await paymentService.processPayment(request, 'test-provider');

      const transactions = await paymentService.getTransactionsByOrganization('org_metadata');
      expect(transactions).toHaveLength(1);
      expect(transactions[0].metadata).toEqual({
        orderId: 'order_123',
        customField: 'custom_value'
      });
    });
  });

  describe('getTransaction', () => {
    it('should retrieve transaction by id', async () => {
      const request: PaymentRequest = {
        amount: 1000,
        currency: Currency.BRL,
        organizationId: 'org_123'
      };

      await paymentService.processPayment(request, 'test-provider');
      const transactions = await paymentService.getTransactionsByOrganization('org_123');
      const transactionId = transactions[0].id;

      const retrievedTransaction = await paymentService.getTransaction(transactionId);

      expect(retrievedTransaction).toBeDefined();
      expect(retrievedTransaction!.id).toBe(transactionId);
      expect(retrievedTransaction!.amount).toBe(1000);
    });

    it('should return null for non-existent transaction', async () => {
      const result = await paymentService.getTransaction('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('getTransactionsByOrganization', () => {
    it('should retrieve all transactions for organization', async () => {
      const requests: PaymentRequest[] = [
        {
          amount: 1000,
          currency: Currency.BRL,
          organizationId: 'org_multi'
        },
        {
          amount: 2000,
          currency: Currency.USD,
          organizationId: 'org_multi'
        }
      ];

      for (const request of requests) {
        await paymentService.processPayment(request, 'test-provider');
      }

      const transactions = await paymentService.getTransactionsByOrganization('org_multi');

      expect(transactions).toHaveLength(2);
      expect(transactions.every(t => t.organizationId === 'org_multi')).toBe(true);
      expect(transactions.map(t => t.amount).sort()).toEqual([1000, 2000]);
    });

    it('should return empty array for organization with no transactions', async () => {
      const transactions = await paymentService.getTransactionsByOrganization('org_empty');
      expect(transactions).toHaveLength(0);
    });

    it('should not return transactions from other organizations', async () => {
      await paymentService.processPayment({
        amount: 1000,
        currency: Currency.BRL,
        organizationId: 'org_1'
      }, 'test-provider');

      await paymentService.processPayment({
        amount: 2000,
        currency: Currency.USD,
        organizationId: 'org_2'
      }, 'test-provider');

      const org1Transactions = await paymentService.getTransactionsByOrganization('org_1');
      const org2Transactions = await paymentService.getTransactionsByOrganization('org_2');

      expect(org1Transactions).toHaveLength(1);
      expect(org2Transactions).toHaveLength(1);
      expect(org1Transactions[0].organizationId).toBe('org_1');
      expect(org2Transactions[0].organizationId).toBe('org_2');
    });
  });

  describe('Transaction Status Tracking', () => {
    it('should track transaction status progression correctly', async () => {
      const request: PaymentRequest = {
        amount: 1000,
        currency: Currency.BRL,
        organizationId: 'org_status'
      };

      await paymentService.processPayment(request, 'test-provider');

      const transactions = await paymentService.getTransactionsByOrganization('org_status');
      const transaction = transactions[0];

      expect(transaction.status).toBe(TransactionStatus.COMPLETED);
      expect(transaction.completedAt).toBeDefined();
      expect(transaction.providerTransactionId).toBe('provider_tx_123');
    });

    it('should set correct transaction type', async () => {
      const request: PaymentRequest = {
        amount: 1000,
        currency: Currency.BRL,
        organizationId: 'org_type'
      };

      await paymentService.processPayment(request, 'test-provider');

      const transactions = await paymentService.getTransactionsByOrganization('org_type');
      expect(transactions[0].type).toBe(TransactionType.PAYMENT);
    });
  });

  describe('Error Handling', () => {
    it('should handle provider errors gracefully', async () => {
      const errorProvider = new MockPaymentProvider('error-provider', '1.0.0', true);
      providerRegistry.set('error-provider', errorProvider);

      const request: PaymentRequest = {
        amount: 1000,
        currency: Currency.BRL,
        organizationId: 'org_error'
      };

      await expect(paymentService.processPayment(request, 'error-provider'))
        .rejects.toThrow('Payment failed');

      const transactions = await paymentService.getTransactionsByOrganization('org_error');
      expect(transactions).toHaveLength(1);
      expect(transactions[0].status).toBe(TransactionStatus.FAILED);
    });

    it('should handle repository errors during transaction creation', async () => {
      const errorRepository = {
        create: jest.fn().mockRejectedValue(new Error('Database error')),
        update: jest.fn(),
        findById: jest.fn(),
        findByOrganizationId: jest.fn(),
        findByProviderTransactionId: jest.fn(),
        delete: jest.fn()
      } as any;

      const serviceWithErrorRepo = new PaymentService(errorRepository, providerRegistry);

      const request: PaymentRequest = {
        amount: 1000,
        currency: Currency.BRL,
        organizationId: 'org_db_error'
      };

      await expect(serviceWithErrorRepo.processPayment(request, 'test-provider'))
        .rejects.toThrow('Database error');
    });
  });
});