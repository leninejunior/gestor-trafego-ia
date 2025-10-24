import { IPaymentProvider, PaymentRequest, PaymentResponse } from '../../domain/ports/payment-provider.port';
import { ITransactionRepository } from '../../domain/ports/repositories.port';
import { Transaction, TransactionEntity, TransactionType, TransactionStatus } from '../../domain/entities/transaction';
import { Logger } from '../../infrastructure/logging/logger';
import { v4 as uuidv4 } from 'uuid';

export class PaymentService {
  private logger = Logger.getInstance();

  constructor(
    private transactionRepository: ITransactionRepository,
    private providerRegistry: Map<string, IPaymentProvider>
  ) {}

  async processPayment(request: PaymentRequest, providerName?: string): Promise<PaymentResponse> {
    const transactionId = uuidv4();
    
    // Create transaction record
    const transaction = new TransactionEntity(
      transactionId,
      request.organizationId,
      providerName || 'auto',
      TransactionType.PAYMENT,
      TransactionStatus.PENDING,
      request.amount,
      request.currency,
      request.metadata || {}
    );

    await this.transactionRepository.create(transaction);

    try {
      // Get provider (with failover if no specific provider requested)
      const provider = providerName 
        ? this.getProvider(providerName)
        : await this.getAvailableProvider();

      if (!provider) {
        throw new Error('No payment provider available');
      }

      // Update transaction with actual provider
      transaction.providerName = provider.name;
      transaction.status = TransactionStatus.PROCESSING;
      await this.transactionRepository.update(transaction);

      // Process payment
      const response = await provider.createPayment(request);

      // Update transaction with provider response
      transaction.providerTransactionId = response.providerTransactionId;
      transaction.status = TransactionStatus.COMPLETED;
      transaction.completedAt = new Date();
      await this.transactionRepository.update(transaction);

      this.logger.info('Payment processed successfully', {
        transactionId,
        providerName: provider.name,
        amount: request.amount,
        currency: request.currency
      });

      return response;

    } catch (error) {
      // Update transaction with failure
      transaction.status = TransactionStatus.FAILED;
      transaction.failureReason = error instanceof Error ? error.message : 'Unknown error';
      transaction.completedAt = new Date();
      await this.transactionRepository.update(transaction);

      this.logger.error('Payment processing failed', {
        transactionId,
        error: error instanceof Error ? error.message : error
      });

      throw error;
    }
  }

  private getProvider(name: string): IPaymentProvider | null {
    return this.providerRegistry.get(name) || null;
  }

  private async getAvailableProvider(): Promise<IPaymentProvider | null> {
    // Simple implementation - in real scenario, this would implement failover logic
    const providers = Array.from(this.providerRegistry.values());
    return providers.length > 0 ? providers[0] : null;
  }

  async getTransaction(id: string): Promise<Transaction | null> {
    return this.transactionRepository.findById(id);
  }

  async getTransactionsByOrganization(organizationId: string): Promise<Transaction[]> {
    return this.transactionRepository.findByOrganizationId(organizationId);
  }
}