export enum TransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export enum TransactionType {
  PAYMENT = 'payment',
  REFUND = 'refund',
  SUBSCRIPTION = 'subscription',
}

export interface Transaction {
  id: string;
  organizationId: string;
  providerName: string;
  providerTransactionId?: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  currency: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  failureReason?: string;
}

export class TransactionEntity implements Transaction {
  constructor(
    public id: string,
    public organizationId: string,
    public providerName: string,
    public type: TransactionType,
    public status: TransactionStatus,
    public amount: number,
    public currency: string,
    public metadata: Record<string, any> = {},
    public createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
    public providerTransactionId?: string,
    public completedAt?: Date,
    public failureReason?: string
  ) {}

  updateStatus(status: TransactionStatus, failureReason?: string): void {
    this.status = status;
    this.updatedAt = new Date();
    
    if (status === TransactionStatus.COMPLETED || status === TransactionStatus.FAILED) {
      this.completedAt = new Date();
    }
    
    if (failureReason) {
      this.failureReason = failureReason;
    }
  }

  isCompleted(): boolean {
    return this.status === TransactionStatus.COMPLETED;
  }

  isFailed(): boolean {
    return this.status === TransactionStatus.FAILED;
  }

  canBeRetried(): boolean {
    return this.status === TransactionStatus.FAILED || this.status === TransactionStatus.PENDING;
  }
}