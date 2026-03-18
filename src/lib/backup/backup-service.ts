/**
 * Backup and Recovery Service
 * 
 * Implementa sistema de backup automático para dados críticos
 * e procedures de recovery documentados
 */

import { resilientDb } from '@/lib/resilience/database-resilience';

export interface BackupConfig {
  enabled: boolean;
  schedule: string; // Cron expression
  retentionDays: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  destinations: BackupDestination[];
}

export interface BackupDestination {
  type: 'local' | 's3' | 'gcs' | 'azure';
  config: Record<string, any>;
  priority: number;
}

export interface BackupMetadata {
  id: string;
  timestamp: Date;
  type: 'full' | 'incremental' | 'critical_data';
  size: number;
  checksum: string;
  tables: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  destination: string;
  error?: string;
}

export interface RecoveryProcedure {
  name: string;
  description: string;
  steps: RecoveryStep[];
  estimatedTime: string;
  prerequisites: string[];
  rollbackSteps?: RecoveryStep[];
}

export interface RecoveryStep {
  order: number;
  description: string;
  command?: string;
  verification?: string;
  critical: boolean;
}

/**
 * Serviço de backup e recovery
 */
export class BackupService {
  private config: BackupConfig = {
    enabled: true,
    schedule: '0 2 * * *', // Diariamente às 2h
    retentionDays: 30,
    compressionEnabled: true,
    encryptionEnabled: true,
    destinations: [
      {
        type: 'local',
        config: { path: '/backups' },
        priority: 1
      }
    ]
  };

  private backupHistory: BackupMetadata[] = [];

  constructor(config?: Partial<BackupConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Executa backup completo dos dados críticos
   */
  async createFullBackup(): Promise<BackupMetadata> {
    const backupId = this.generateBackupId();
    const metadata: BackupMetadata = {
      id: backupId,
      timestamp: new Date(),
      type: 'full',
      size: 0,
      checksum: '',
      tables: [
        'subscription_intents',
        'subscriptions',
        'webhook_logs',
        'payment_analytics',
        'organizations',
        'users'
      ],
      status: 'pending',
      destination: 'local'
    };

    try {
      console.log(`[Backup] Starting full backup ${backupId}`);
      metadata.status = 'in_progress';
      
      // Backup de subscription_intents críticos
      const criticalIntents = await this.backupCriticalSubscriptionIntents();
      
      // Backup de webhook logs recentes
      const webhookLogs = await this.backupRecentWebhookLogs();
      
      // Backup de configurações de organizações
      const organizations = await this.backupOrganizations();
      
      // Backup de planos de assinatura
      const subscriptionPlans = await this.backupSubscriptionPlans();
      
      const backupData = {
        metadata,
        data: {
          subscription_intents: criticalIntents,
          webhook_logs: webhookLogs,
          organizations: organizations,
          subscription_plans: subscriptionPlans
        }
      };

      // Salva backup
      const backupPath = await this.saveBackup(backupId, backupData);
      
      // Calcula checksum
      metadata.checksum = await this.calculateChecksum(backupPath);
      metadata.size = await this.getFileSize(backupPath);
      metadata.status = 'completed';
      
      this.backupHistory.push(metadata);
      
      console.log(`[Backup] Full backup ${backupId} completed successfully`);
      
      // Limpa backups antigos
      await this.cleanupOldBackups();
      
      return metadata;
      
    } catch (error) {
      console.error(`[Backup] Full backup ${backupId} failed:`, error);
      metadata.status = 'failed';
      metadata.error = (error as Error).message;
      
      this.backupHistory.push(metadata);
      throw error;
    }
  }

  /**
   * Backup incremental apenas de dados modificados
   */
  async createIncrementalBackup(since?: Date): Promise<BackupMetadata> {
    const backupId = this.generateBackupId('inc');
    const sinceDate = since || new Date(Date.now() - 24 * 60 * 60 * 1000); // Últimas 24h
    
    const metadata: BackupMetadata = {
      id: backupId,
      timestamp: new Date(),
      type: 'incremental',
      size: 0,
      checksum: '',
      tables: ['subscription_intents', 'webhook_logs'],
      status: 'pending',
      destination: 'local'
    };

    try {
      console.log(`[Backup] Starting incremental backup ${backupId} since ${sinceDate.toISOString()}`);
      metadata.status = 'in_progress';
      
      // Backup apenas de dados modificados
      const modifiedIntents = await this.backupModifiedSubscriptionIntents(sinceDate);
      const recentWebhooks = await this.backupRecentWebhookLogs(sinceDate);
      
      const backupData = {
        metadata,
        data: {
          subscription_intents: modifiedIntents,
          webhook_logs: recentWebhooks
        }
      };

      const backupPath = await this.saveBackup(backupId, backupData);
      
      metadata.checksum = await this.calculateChecksum(backupPath);
      metadata.size = await this.getFileSize(backupPath);
      metadata.status = 'completed';
      
      this.backupHistory.push(metadata);
      
      console.log(`[Backup] Incremental backup ${backupId} completed`);
      
      return metadata;
      
    } catch (error) {
      console.error(`[Backup] Incremental backup ${backupId} failed:`, error);
      metadata.status = 'failed';
      metadata.error = (error as Error).message;
      
      this.backupHistory.push(metadata);
      throw error;
    }
  }

  /**
   * Backup apenas de dados críticos (subscription_intents ativos)
   */
  async createCriticalDataBackup(): Promise<BackupMetadata> {
    const backupId = this.generateBackupId('critical');
    
    const metadata: BackupMetadata = {
      id: backupId,
      timestamp: new Date(),
      type: 'critical_data',
      size: 0,
      checksum: '',
      tables: ['subscription_intents'],
      status: 'pending',
      destination: 'local'
    };

    try {
      console.log(`[Backup] Starting critical data backup ${backupId}`);
      metadata.status = 'in_progress';
      
      const criticalIntents = await this.backupCriticalSubscriptionIntents();
      
      const backupData = {
        metadata,
        data: {
          subscription_intents: criticalIntents
        }
      };

      const backupPath = await this.saveBackup(backupId, backupData);
      
      metadata.checksum = await this.calculateChecksum(backupPath);
      metadata.size = await this.getFileSize(backupPath);
      metadata.status = 'completed';
      
      this.backupHistory.push(metadata);
      
      console.log(`[Backup] Critical data backup ${backupId} completed`);
      
      return metadata;
      
    } catch (error) {
      console.error(`[Backup] Critical data backup ${backupId} failed:`, error);
      metadata.status = 'failed';
      metadata.error = (error as Error).message;
      
      this.backupHistory.push(metadata);
      throw error;
    }
  }

  /**
   * Backup de subscription_intents críticos
   */
  private async backupCriticalSubscriptionIntents(): Promise<any[]> {
    return resilientDb.execute({
      operation: async (client) => {
        const { data, error } = await client
          .from('subscription_intents')
          .select('*')
          .in('status', ['pending', 'processing', 'degraded_pending'])
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()); // Últimos 7 dias
        
        if (error) throw error;
        return data || [];
      },
      operationName: 'backup-critical-subscription-intents'
    });
  }

  /**
   * Backup de subscription_intents modificados
   */
  private async backupModifiedSubscriptionIntents(since: Date): Promise<any[]> {
    return resilientDb.execute({
      operation: async (client) => {
        const { data, error } = await client
          .from('subscription_intents')
          .select('*')
          .gte('updated_at', since.toISOString());
        
        if (error) throw error;
        return data || [];
      },
      operationName: 'backup-modified-subscription-intents'
    });
  }

  /**
   * Backup de webhook logs recentes
   */
  private async backupRecentWebhookLogs(since?: Date): Promise<any[]> {
    const sinceDate = since || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Últimos 7 dias
    
    return resilientDb.execute({
      operation: async (client) => {
        const { data, error } = await client
          .from('webhook_logs')
          .select('*')
          .gte('created_at', sinceDate.toISOString())
          .order('created_at', { ascending: false })
          .limit(10000); // Limita para evitar backups muito grandes
        
        if (error) throw error;
        return data || [];
      },
      operationName: 'backup-recent-webhook-logs'
    });
  }

  /**
   * Backup de organizações
   */
  private async backupOrganizations(): Promise<any[]> {
    return resilientDb.execute({
      operation: async (client) => {
        const { data, error } = await client
          .from('organizations')
          .select('*');
        
        if (error) throw error;
        return data || [];
      },
      operationName: 'backup-organizations'
    });
  }

  /**
   * Backup de planos de assinatura
   */
  private async backupSubscriptionPlans(): Promise<any[]> {
    return resilientDb.execute({
      operation: async (client) => {
        const { data, error } = await client
          .from('subscription_plans')
          .select('*');
        
        if (error) throw error;
        return data || [];
      },
      operationName: 'backup-subscription-plans'
    });
  }

  /**
   * Salva backup em arquivo
   */
  private async saveBackup(backupId: string, data: any): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${backupId}_${timestamp}.json`;
    const backupPath = `/tmp/${filename}`; // Em produção, usar path configurável
    
    try {
      const fs = await import('fs/promises');
      
      let content = JSON.stringify(data, null, 2);
      
      // Compressão se habilitada
      if (this.config.compressionEnabled) {
        const zlib = await import('zlib');
        const compressed = zlib.gzipSync(Buffer.from(content));
        await fs.writeFile(`${backupPath}.gz`, compressed);
        return `${backupPath}.gz`;
      } else {
        await fs.writeFile(backupPath, content);
        return backupPath;
      }
      
    } catch (error) {
      console.error(`[Backup] Failed to save backup to ${backupPath}:`, error);
      throw error;
    }
  }

  /**
   * Calcula checksum do arquivo de backup
   */
  private async calculateChecksum(filePath: string): Promise<string> {
    try {
      const crypto = await import('crypto');
      const fs = await import('fs/promises');
      
      const content = await fs.readFile(filePath);
      return crypto.createHash('sha256').update(content).digest('hex');
      
    } catch (error) {
      console.error(`[Backup] Failed to calculate checksum for ${filePath}:`, error);
      return '';
    }
  }

  /**
   * Obtém tamanho do arquivo
   */
  private async getFileSize(filePath: string): Promise<number> {
    try {
      const fs = await import('fs/promises');
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch (error) {
      console.error(`[Backup] Failed to get file size for ${filePath}:`, error);
      return 0;
    }
  }

  /**
   * Limpa backups antigos baseado na retenção configurada
   */
  private async cleanupOldBackups(): Promise<void> {
    const cutoffDate = new Date(Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000);
    
    const oldBackups = this.backupHistory.filter(backup => 
      backup.timestamp < cutoffDate && backup.status === 'completed'
    );

    for (const backup of oldBackups) {
      try {
        const fs = await import('fs/promises');
        const backupPath = `/tmp/backup_${backup.id}_*`;
        
        // Remove arquivo físico (implementação simplificada)
        console.log(`[Backup] Would cleanup old backup: ${backup.id}`);
        
        // Remove do histórico
        const index = this.backupHistory.indexOf(backup);
        if (index > -1) {
          this.backupHistory.splice(index, 1);
        }
        
      } catch (error) {
        console.error(`[Backup] Failed to cleanup backup ${backup.id}:`, error);
      }
    }
  }

  /**
   * Restaura dados de um backup
   */
  async restoreFromBackup(backupId: string, tables?: string[]): Promise<void> {
    console.log(`[Backup] Starting restore from backup ${backupId}`);
    
    try {
      const backup = this.backupHistory.find(b => b.id === backupId);
      if (!backup) {
        throw new Error(`Backup ${backupId} not found`);
      }

      if (backup.status !== 'completed') {
        throw new Error(`Backup ${backupId} is not in completed state`);
      }

      // Carrega dados do backup
      const backupData = await this.loadBackup(backupId);
      
      // Valida checksum
      const currentChecksum = await this.calculateChecksum(this.getBackupPath(backupId));
      if (currentChecksum !== backup.checksum) {
        throw new Error(`Backup ${backupId} checksum validation failed`);
      }

      // Restaura tabelas especificadas ou todas
      const tablesToRestore = tables || backup.tables;
      
      for (const table of tablesToRestore) {
        if (backupData.data[table]) {
          await this.restoreTable(table, backupData.data[table]);
        }
      }
      
      console.log(`[Backup] Restore from backup ${backupId} completed successfully`);
      
    } catch (error) {
      console.error(`[Backup] Restore from backup ${backupId} failed:`, error);
      throw error;
    }
  }

  /**
   * Carrega dados de um backup
   */
  private async loadBackup(backupId: string): Promise<any> {
    const backupPath = this.getBackupPath(backupId);
    
    try {
      const fs = await import('fs/promises');
      
      let content: Buffer;
      
      if (backupPath.endsWith('.gz')) {
        const zlib = await import('zlib');
        const compressed = await fs.readFile(backupPath);
        content = zlib.gunzipSync(compressed);
      } else {
        content = await fs.readFile(backupPath);
      }
      
      return JSON.parse(content.toString());
      
    } catch (error) {
      console.error(`[Backup] Failed to load backup from ${backupPath}:`, error);
      throw error;
    }
  }

  /**
   * Restaura uma tabela específica
   */
  private async restoreTable(tableName: string, data: any[]): Promise<void> {
    console.log(`[Backup] Restoring table ${tableName} with ${data.length} records`);
    
    await resilientDb.execute({
      operation: async (client) => {
        // Em um cenário real, seria mais cuidadoso com a restauração
        // Aqui é uma implementação simplificada
        
        for (const record of data) {
          const { error } = await client
            .from(tableName)
            .upsert(record, { onConflict: 'id' });
          
          if (error) {
            console.error(`[Backup] Failed to restore record in ${tableName}:`, error);
            // Continua com próximo registro
          }
        }
      },
      operationName: `restore-table-${tableName}`
    });
  }

  /**
   * Obtém caminho do arquivo de backup
   */
  private getBackupPath(backupId: string): string {
    // Implementação simplificada - em produção, buscaria no sistema de arquivos
    return `/tmp/backup_${backupId}_*.json`;
  }

  /**
   * Gera ID único para backup
   */
  private generateBackupId(prefix: string = 'full'): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 6);
    return `${prefix}_${timestamp}_${random}`;
  }

  /**
   * Obtém histórico de backups
   */
  getBackupHistory(): BackupMetadata[] {
    return [...this.backupHistory];
  }

  /**
   * Verifica integridade de um backup
   */
  async verifyBackup(backupId: string): Promise<boolean> {
    try {
      const backup = this.backupHistory.find(b => b.id === backupId);
      if (!backup) {
        return false;
      }

      const backupPath = this.getBackupPath(backupId);
      const currentChecksum = await this.calculateChecksum(backupPath);
      
      return currentChecksum === backup.checksum;
      
    } catch (error) {
      console.error(`[Backup] Failed to verify backup ${backupId}:`, error);
      return false;
    }
  }

  /**
   * Obtém procedures de recovery documentados
   */
  getRecoveryProcedures(): RecoveryProcedure[] {
    return [
      {
        name: 'subscription_intents_recovery',
        description: 'Recuperação de subscription intents perdidos ou corrompidos',
        estimatedTime: '15-30 minutos',
        prerequisites: [
          'Backup válido disponível',
          'Acesso ao banco de dados',
          'Confirmação de que o Iugu está funcionando'
        ],
        steps: [
          {
            order: 1,
            description: 'Identificar subscription intents afetados',
            command: 'SELECT * FROM subscription_intents WHERE status IN (\'pending\', \'processing\') AND updated_at < NOW() - INTERVAL \'1 hour\'',
            verification: 'Verificar se a query retorna os registros esperados',
            critical: true
          },
          {
            order: 2,
            description: 'Fazer backup dos dados atuais antes da recuperação',
            command: 'npm run backup:critical',
            verification: 'Confirmar que o backup foi criado com sucesso',
            critical: true
          },
          {
            order: 3,
            description: 'Restaurar subscription intents do backup',
            command: 'npm run restore:subscription-intents --backup-id=<BACKUP_ID>',
            verification: 'Verificar se os registros foram restaurados corretamente',
            critical: true
          },
          {
            order: 4,
            description: 'Reprocessar intents pendentes',
            command: 'npm run process:pending-intents',
            verification: 'Confirmar que os intents foram processados no Iugu',
            critical: false
          }
        ],
        rollbackSteps: [
          {
            order: 1,
            description: 'Restaurar backup feito no passo 2',
            command: 'npm run restore:from-backup --backup-id=<PRE_RECOVERY_BACKUP>',
            verification: 'Verificar se o estado anterior foi restaurado',
            critical: true
          }
        ]
      },
      {
        name: 'webhook_logs_recovery',
        description: 'Recuperação de logs de webhook para auditoria',
        estimatedTime: '10-15 minutos',
        prerequisites: [
          'Backup com webhook logs disponível',
          'Período específico para recuperação identificado'
        ],
        steps: [
          {
            order: 1,
            description: 'Identificar período de logs perdidos',
            verification: 'Confirmar datas de início e fim do período afetado',
            critical: true
          },
          {
            order: 2,
            description: 'Restaurar webhook logs do backup',
            command: 'npm run restore:webhook-logs --from=<START_DATE> --to=<END_DATE>',
            verification: 'Verificar se os logs foram restaurados no período correto',
            critical: true
          }
        ]
      }
    ];
  }
}

/**
 * Instância singleton do serviço de backup
 */
export const backupService = new BackupService();