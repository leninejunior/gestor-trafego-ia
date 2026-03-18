import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum ProviderHealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
}

@Entity('provider_health')
@Index(['providerName', 'createdAt'])
@Index(['status', 'createdAt'])
export class ProviderHealthEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'provider_name', length: 50 })
  providerName!: string;

  @Column({
    type: 'enum',
    enum: ProviderHealthStatus,
  })
  status!: ProviderHealthStatus;

  @Column({ name: 'response_time_ms', type: 'integer', nullable: true })
  responseTimeMs?: number;

  @Column({ name: 'error_rate', type: 'decimal', precision: 5, scale: 2, nullable: true })
  errorRate?: number;

  @Column({ name: 'last_check', type: 'timestamp with time zone' })
  lastCheck!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}