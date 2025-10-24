import { Repository } from 'typeorm';
import { AppDataSource } from '../data-source';
import { ProviderConfigEntity } from '../entities/provider-config.entity';
import { IProviderConfigRepository } from '../../../domain/ports/repositories.port';
import { ProviderConfig } from '../../../domain/entities/provider-config';
import { EncryptionService } from '../../security/encryption.service';

export class ProviderConfigRepository implements IProviderConfigRepository {
  private repository: Repository<ProviderConfigEntity>;
  private encryptionService: EncryptionService;

  constructor() {
    this.repository = AppDataSource.getRepository(ProviderConfigEntity);
    this.encryptionService = new EncryptionService();
  }

  async create(config: ProviderConfig): Promise<ProviderConfig> {
    const entity = this.repository.create({
      ...config,
      credentialsEncrypted: this.encryptionService.encrypt(JSON.stringify(config.credentials)),
    });
    const saved = await this.repository.save(entity);
    return this.mapToProviderConfig(saved);
  }

  async findById(id: string): Promise<ProviderConfig | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.mapToProviderConfig(entity) : null;
  }

  async findByName(name: string): Promise<ProviderConfig | null> {
    const entity = await this.repository.findOne({ where: { name } });
    return entity ? this.mapToProviderConfig(entity) : null;
  }

  async findAll(): Promise<ProviderConfig[]> {
    const entities = await this.repository.find({
      order: { priority: 'DESC', name: 'ASC' },
    });
    return entities.map(entity => this.mapToProviderConfig(entity));
  }

  async findActive(): Promise<ProviderConfig[]> {
    const entities = await this.repository.find({
      where: { isActive: true },
      order: { priority: 'DESC', name: 'ASC' },
    });
    return entities.map(entity => this.mapToProviderConfig(entity));
  }

  async update(config: ProviderConfig): Promise<ProviderConfig> {
    const updateData = {
      ...config,
      credentialsEncrypted: this.encryptionService.encrypt(JSON.stringify(config.credentials)),
    };
    await this.repository.update(config.id, updateData);
    const updated = await this.repository.findOne({ where: { id: config.id } });
    if (!updated) {
      throw new Error(`ProviderConfig with id ${config.id} not found`);
    }
    return this.mapToProviderConfig(updated);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  private mapToProviderConfig(entity: ProviderConfigEntity): ProviderConfig {
    const credentials = JSON.parse(this.encryptionService.decrypt(entity.credentialsEncrypted));
    
    return {
      id: entity.id,
      name: entity.name,
      isActive: entity.isActive,
      priority: entity.priority,
      credentials,
      settings: entity.settings,
      healthCheckUrl: entity.healthCheckUrl,
      webhookUrl: entity.webhookUrl,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}