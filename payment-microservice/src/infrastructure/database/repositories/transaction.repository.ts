import { Repository } from 'typeorm';
import { AppDataSource } from '../data-source';
import { TransactionEntity } from '../entities/transaction.entity';
import { ITransactionRepository } from '../../../domain/ports/repositories.port';
import { Transaction } from '../../../domain/entities/transaction';

export class TransactionRepository implements ITransactionRepository {
  private repository: Repository<TransactionEntity>;

  constructor() {
    this.repository = AppDataSource.getRepository(TransactionEntity);
  }

  async create(transaction: Transaction): Promise<Transaction> {
    const entity = this.repository.create(transaction);
    const saved = await this.repository.save(entity);
    return this.mapToTransaction(saved);
  }

  async findById(id: string): Promise<Transaction | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.mapToTransaction(entity) : null;
  }

  async findByOrganizationId(organizationId: string): Promise<Transaction[]> {
    const entities = await this.repository.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
    return entities.map(entity => this.mapToTransaction(entity));
  }

  async findByProviderTransactionId(providerTransactionId: string): Promise<Transaction | null> {
    const entity = await this.repository.findOne({
      where: { providerTransactionId },
    });
    return entity ? this.mapToTransaction(entity) : null;
  }

  async update(transaction: Transaction): Promise<Transaction> {
    await this.repository.update(transaction.id, transaction);
    const updated = await this.repository.findOne({ where: { id: transaction.id } });
    if (!updated) {
      throw new Error(`Transaction with id ${transaction.id} not found`);
    }
    return this.mapToTransaction(updated);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  private mapToTransaction(entity: TransactionEntity): Transaction {
    return {
      id: entity.id,
      organizationId: entity.organizationId,
      providerName: entity.providerName,
      providerTransactionId: entity.providerTransactionId,
      type: entity.type,
      status: entity.status,
      amount: Number(entity.amount),
      currency: entity.currency,
      metadata: entity.metadata,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      completedAt: entity.completedAt,
      failureReason: entity.failureReason,
    };
  }
}