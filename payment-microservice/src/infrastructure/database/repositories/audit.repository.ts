import { Repository } from 'typeorm';
import { AppDataSource } from '../data-source';
import { AuditLogEntity } from '../entities/audit-log.entity';
import { IAuditRepository } from '../../../domain/ports/repositories.port';

export class AuditRepository implements IAuditRepository {
  private repository: Repository<AuditLogEntity>;

  constructor() {
    this.repository = AppDataSource.getRepository(AuditLogEntity);
  }

  async log(action: string, data: Record<string, any>): Promise<void> {
    const auditLog = this.repository.create({
      action,
      transactionId: data.transactionId,
      providerName: data.providerName,
      requestData: data.requestData,
      responseData: data.responseData,
      errorData: data.errorData,
    });

    await this.repository.save(auditLog);
  }

  async findByTransactionId(transactionId: string): Promise<any[]> {
    const logs = await this.repository.find({
      where: { transactionId },
      order: { createdAt: 'ASC' },
    });

    return logs.map(log => ({
      id: log.id,
      action: log.action,
      providerName: log.providerName,
      requestData: log.requestData,
      responseData: log.responseData,
      errorData: log.errorData,
      createdAt: log.createdAt,
    }));
  }
}