import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('provider_configs')
@Index(['name'], { unique: true })
@Index(['isActive', 'priority'])
export class ProviderConfigEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 50, unique: true })
  name!: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ default: 0 })
  priority!: number;

  @Column({ name: 'credentials_encrypted', type: 'text' })
  credentialsEncrypted!: string;

  @Column({ type: 'jsonb', default: {} })
  settings!: Record<string, any>;

  @Column({ name: 'health_check_url', length: 500, nullable: true })
  healthCheckUrl?: string;

  @Column({ name: 'webhook_url', length: 500, nullable: true })
  webhookUrl?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}