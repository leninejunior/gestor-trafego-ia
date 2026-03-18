import { Transaction } from '../entities/transaction';
import { ProviderConfig } from '../entities/provider-config';

export interface ITransactionRepository {
  create(transaction: Transaction): Promise<Transaction>;
  findById(id: string): Promise<Transaction | null>;
  findByOrganizationId(organizationId: string): Promise<Transaction[]>;
  findByProviderTransactionId(providerTransactionId: string): Promise<Transaction | null>;
  update(transaction: Transaction): Promise<Transaction>;
  delete(id: string): Promise<void>;
}

export interface IProviderConfigRepository {
  create(config: ProviderConfig): Promise<ProviderConfig>;
  findById(id: string): Promise<ProviderConfig | null>;
  findByName(name: string): Promise<ProviderConfig | null>;
  findAll(): Promise<ProviderConfig[]>;
  findActive(): Promise<ProviderConfig[]>;
  update(config: ProviderConfig): Promise<ProviderConfig>;
  delete(id: string): Promise<void>;
}

export interface IAuditRepository {
  log(action: string, data: Record<string, any>): Promise<void>;
  findByTransactionId(transactionId: string): Promise<any[]>;
}