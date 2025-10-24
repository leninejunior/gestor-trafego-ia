import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { TransactionEntity } from './transaction.entity';

@Entity('audit_logs')
@Index(['transactionId', 'createdAt'])
@Index(['action', 'createdAt'])
@Index(['providerName', 'createdAt'])
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'transaction_id', type: 'uuid', nullable: true })
  transactionId?: string;

  @ManyToOne(() => TransactionEntity, { nullable: true })
  @JoinColumn({ name: 'transaction_id' })
  transaction?: TransactionEntity;

  @Column({ length: 50 })
  action!: string;

  @Column({ name: 'provider_name', length: 50, nullable: true })
  providerName?: string;

  @Column({ name: 'request_data', type: 'jsonb', nullable: true })
  requestData?: Record<string, any>;

  @Column({ name: 'response_data', type: 'jsonb', nullable: true })
  responseData?: Record<string, any>;

  @Column({ name: 'error_data', type: 'jsonb', nullable: true })
  errorData?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}