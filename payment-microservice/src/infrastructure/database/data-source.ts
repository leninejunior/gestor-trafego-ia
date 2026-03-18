import { DataSource } from 'typeorm';
import { config } from '../config/environment';
import { TransactionEntity } from './entities/transaction.entity';
import { ProviderConfigEntity } from './entities/provider-config.entity';
import { AuditLogEntity } from './entities/audit-log.entity';
import { ProviderHealthEntity } from './entities/provider-health.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: config.database.host,
  port: config.database.port,
  username: config.database.user,
  password: config.database.password,
  database: config.database.name,
  ssl: config.database.ssl,
  synchronize: config.env === 'development',
  logging: config.env === 'development',
  entities: [
    TransactionEntity,
    ProviderConfigEntity,
    AuditLogEntity,
    ProviderHealthEntity,
  ],
  migrations: ['src/infrastructure/database/migrations/*.ts'],
  subscribers: ['src/infrastructure/database/subscribers/*.ts'],
  maxQueryExecutionTime: 5000,
  extra: {
    connectionLimit: 10,
    acquireTimeout: 60000,
    timeout: 60000,
  },
});

export async function initializeDatabase(): Promise<void> {
  try {
    await AppDataSource.initialize();
    console.log('Database connection initialized successfully');
    
    if (config.env !== 'production') {
      await AppDataSource.runMigrations();
      console.log('Database migrations executed successfully');
    }
  } catch (error) {
    console.error('Error during database initialization:', error);
    throw error;
  }
}