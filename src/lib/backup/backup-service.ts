/**
 * Serviço de Backup Automático
 * - Backup completo e incremental
 * - Compressão e armazenamento
 * - Agendamento automático
 * - Recuperação de dados
 * - Monitoramento de integridade
 */

import { createClient } from '@/lib/supabase/server'
import { promises as fs } from 'fs'
import path from 'path'
import { createGzip } from 'zlib'
import { pipeline } from 'stream/promises'

interface BackupConfig {
  organizationId: string
  tables: string[]
  type: 'full' | 'incremental' | 'manual'
  compression: boolean
  retention: {
    daily: number    // dias
    weekly: number   // semanas
    monthly: number  // meses
  }
}

interface BackupResult {
  success: boolean
  backupId: string
  filePath?: string
  fileSize?: number
  duration: number
  tablesBackedUp: string[]
  error?: string
}

export class BackupService {
  private supabase = createClient()
  private backupDir = process.env.BACKUP_DIR || './backups'

  /**
   * Executa backup completo de uma organização
   */
  async createFullBackup(organizationId: string): Promise<BackupResult> {
    const startTime = Date.now()
    const backupId = this.generateBackupId('full')

    console.log(`Starting full backup for organization ${organizationId}`)

    try {
      // Registrar início do backup
      await this.logBackupStart(backupId, organizationId, 'full')

      const config: BackupConfig = {
        organizationId,
        tables: [
          'organizations',
          'organization_members',
          'clients',
          'meta_connections',
          'meta_accounts',
          'meta_campaigns',
          'meta_insights',
          'notifications',
          'notification_rules',
          'workflows',
          'workflow_executions'
        ],
        type: 'full',
        compression: true,
        retention: { daily: 7, weekly: 4, monthly: 12 }
      }

      const result = await this.executeBackup(backupId, config)
      
      // Registrar conclusão
      await this.logBackupComplete(backupId, result)
      
      return result
    } catch (error) {
      const result: BackupResult = {
        success: false,
        backupId,
        duration: Date.now() - startTime,
        tablesBackedUp: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      }

      await this.logBackupComplete(backupId, result)
      return result
    }
  }

  /**
   * Executa backup incremental (apenas dados modificados)
   */
  async createIncrementalBackup(organizationId: string, since?: Date): Promise<BackupResult> {
    const startTime = Date.now()
    const backupId = this.generateBackupId('incremental')

    console.log(`Starting incremental backup for organization ${organizationId}`)

    try {
      // Se não especificado, usar último backup como referência
      if (!since) {
        const { data: lastBackup } = await this.supabase
          .from('backup_logs')
          .select('completed_at')
          .eq('organization_id', organizationId)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(1)
          .single()

        since = lastBackup?.completed_at ? new Date(lastBackup.completed_at) : new Date(Date.now() - 24 * 60 * 60 * 1000)
      }

      await this.logBackupStart(backupId, organizationId, 'incremental')

      const config: BackupConfig = {
        organizationId,
        tables: [
          'meta_campaigns',
          'meta_insights',
          'notifications',
          'workflow_executions'
        ],
        type: 'incremental',
        compression: true,
        retention: { daily: 30, weekly: 12, monthly: 6 }
      }

      const result = await this.executeIncrementalBackup(backupId, config, since)
      
      await this.logBackupComplete(backupId, result)
      return result
    } catch (error) {
      const result: BackupResult = {
        success: false,
        backupId,
        duration: Date.now() - startTime,
        tablesBackedUp: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      }

      await this.logBackupComplete(backupId, result)
      return result
    }
  }

  /**
   * Executa o backup propriamente dito
   */
  private async executeBackup(backupId: string, config: BackupConfig): Promise<BackupResult> {
    const startTime = Date.now()
    const fileName = `${backupId}.sql${config.compression ? '.gz' : ''}`
    const filePath = path.join(this.backupDir, fileName)

    // Garantir que o diretório existe
    await fs.mkdir(this.backupDir, { recursive: true })

    let sqlContent = ''
    const backedUpTables: string[] = []

    // Gerar SQL para cada tabela
    for (const table of config.tables) {
      try {
        const tableBackup = await this.backupTable(table, config.organizationId)
        if (tableBackup) {
          sqlContent += tableBackup + '\n\n'
          backedUpTables.push(table)
        }
      } catch (error) {
        console.error(`Error backing up table ${table}:`, error)
      }
    }

    // Salvar arquivo
    if (config.compression) {
      await this.writeCompressedFile(filePath, sqlContent)
    } else {
      await fs.writeFile(filePath, sqlContent, 'utf8')
    }

    const stats = await fs.stat(filePath)

    return {
      success: true,
      backupId,
      filePath,
      fileSize: stats.size,
      duration: Date.now() - startTime,
      tablesBackedUp: backedUpTables
    }
  }

  /**
   * Executa backup incremental
   */
  private async executeIncrementalBackup(
    backupId: string,
    config: BackupConfig,
    since: Date
  ): Promise<BackupResult> {
    const startTime = Date.now()
    const fileName = `${backupId}.sql${config.compression ? '.gz' : ''}`
    const filePath = path.join(this.backupDir, fileName)

    await fs.mkdir(this.backupDir, { recursive: true })

    let sqlContent = `-- Incremental backup since ${since.toISOString()}\n\n`
    const backedUpTables: string[] = []

    // Backup apenas dados modificados
    for (const table of config.tables) {
      try {
        const tableBackup = await this.backupTableIncremental(table, config.organizationId, since)
        if (tableBackup) {
          sqlContent += tableBackup + '\n\n'
          backedUpTables.push(table)
        }
      } catch (error) {
        console.error(`Error backing up table ${table} incrementally:`, error)
      }
    }

    if (config.compression) {
      await this.writeCompressedFile(filePath, sqlContent)
    } else {
      await fs.writeFile(filePath, sqlContent, 'utf8')
    }

    const stats = await fs.stat(filePath)

    return {
      success: true,
      backupId,
      filePath,
      fileSize: stats.size,
      duration: Date.now() - startTime,
      tablesBackedUp: backedUpTables
    }
  }

  /**
   * Faz backup de uma tabela específica
   */
  private async backupTable(tableName: string, organizationId: string): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from(tableName)
        .select('*')
        .eq('organization_id', organizationId)

      if (error || !data || data.length === 0) {
        return null
      }

      let sql = `-- Backup of table ${tableName}\n`
      sql += `DELETE FROM ${tableName} WHERE organization_id = '${organizationId}';\n`

      for (const row of data) {
        const columns = Object.keys(row).join(', ')
        const values = Object.values(row)
          .map(value => {
            if (value === null) return 'NULL'
            if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`
            if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`
            return String(value)
          })
          .join(', ')

        sql += `INSERT INTO ${tableName} (${columns}) VALUES (${values});\n`
      }

      return sql
    } catch (error) {
      console.error(`Error backing up table ${tableName}:`, error)
      return null
    }
  }

  /**
   * Faz backup incremental de uma tabela
   */
  private async backupTableIncremental(
    tableName: string,
    organizationId: string,
    since: Date
  ): Promise<string | null> {
    try {
      // Verificar se a tabela tem campo updated_at
      const { data, error } = await this.supabase
        .from(tableName)
        .select('*')
        .eq('organization_id', organizationId)
        .gte('updated_at', since.toISOString())

      if (error || !data || data.length === 0) {
        return null
      }

      let sql = `-- Incremental backup of table ${tableName}\n`

      for (const row of data) {
        const columns = Object.keys(row).join(', ')
        const values = Object.values(row)
          .map(value => {
            if (value === null) return 'NULL'
            if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`
            if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`
            return String(value)
          })
          .join(', ')

        // Usar UPSERT para dados incrementais
        sql += `INSERT INTO ${tableName} (${columns}) VALUES (${values}) ON CONFLICT (id) DO UPDATE SET `
        sql += Object.keys(row)
          .filter(key => key !== 'id')
          .map(key => `${key} = EXCLUDED.${key}`)
          .join(', ')
        sql += ';\n'
      }

      return sql
    } catch (error) {
      console.error(`Error backing up table ${tableName} incrementally:`, error)
      return null
    }
  }

  /**
   * Escreve arquivo comprimido
   */
  private async writeCompressedFile(filePath: string, content: string): Promise<void> {
    const { createReadStream, createWriteStream } = await import('fs')
    const { Readable } = await import('stream')
    
    const readable = Readable.from([content])
    const writeStream = createWriteStream(filePath)
    const gzip = createGzip()

    await pipeline(readable, gzip, writeStream)
  }

  /**
   * Restaura backup de um arquivo
   */
  async restoreBackup(backupId: string, organizationId: string): Promise<boolean> {
    try {
      console.log(`Starting restore of backup ${backupId} for organization ${organizationId}`)

      // Buscar informações do backup
      const { data: backupLog } = await this.supabase
        .from('backup_logs')
        .select('*')
        .eq('id', backupId)
        .eq('organization_id', organizationId)
        .single()

      if (!backupLog || !backupLog.file_path) {
        throw new Error('Backup not found')
      }

      // Ler arquivo de backup
      let sqlContent: string
      
      if (backupLog.file_path.endsWith('.gz')) {
        sqlContent = await this.readCompressedFile(backupLog.file_path)
      } else {
        sqlContent = await fs.readFile(backupLog.file_path, 'utf8')
      }

      // Executar comandos SQL
      const commands = sqlContent
        .split(';')
        .map(cmd => cmd.trim())
        .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'))

      for (const command of commands) {
        try {
          await this.supabase.rpc('exec_sql', { sql_query: command + ';' })
        } catch (error) {
          console.error('Error executing restore command:', error)
        }
      }

      console.log(`Restore of backup ${backupId} completed`)
      return true
    } catch (error) {
      console.error('Error restoring backup:', error)
      return false
    }
  }

  /**
   * Lê arquivo comprimido
   */
  private async readCompressedFile(filePath: string): Promise<string> {
    const { createReadStream } = await import('fs')
    const { createGunzip } = await import('zlib')
    const { pipeline } = await import('stream/promises')
    
    const chunks: Buffer[] = []
    const readStream = createReadStream(filePath)
    const gunzip = createGunzip()
    
    gunzip.on('data', (chunk) => chunks.push(chunk))
    
    await pipeline(readStream, gunzip)
    
    return Buffer.concat(chunks).toString('utf8')
  }

  /**
   * Lista backups disponíveis
   */
  async listBackups(organizationId: string): Promise<any[]> {
    const { data: backups } = await this.supabase
      .from('backup_logs')
      .select('*')
      .eq('organization_id', organizationId)
      .order('started_at', { ascending: false })

    return backups || []
  }

  /**
   * Remove backups antigos baseado na política de retenção
   */
  async cleanupOldBackups(organizationId: string): Promise<number> {
    const retention = {
      daily: 7,
      weekly: 4,
      monthly: 12
    }

    let deletedCount = 0

    try {
      // Remover backups diários antigos
      const dailyCutoff = new Date(Date.now() - retention.daily * 24 * 60 * 60 * 1000)
      const { data: oldDailyBackups } = await this.supabase
        .from('backup_logs')
        .select('id, file_path')
        .eq('organization_id', organizationId)
        .eq('backup_type', 'incremental')
        .lt('started_at', dailyCutoff.toISOString())

      if (oldDailyBackups) {
        for (const backup of oldDailyBackups) {
          await this.deleteBackupFile(backup.file_path)
          await this.supabase
            .from('backup_logs')
            .delete()
            .eq('id', backup.id)
          deletedCount++
        }
      }

      // Remover backups completos muito antigos
      const monthlyCutoff = new Date(Date.now() - retention.monthly * 30 * 24 * 60 * 60 * 1000)
      const { data: oldMonthlyBackups } = await this.supabase
        .from('backup_logs')
        .select('id, file_path')
        .eq('organization_id', organizationId)
        .eq('backup_type', 'full')
        .lt('started_at', monthlyCutoff.toISOString())

      if (oldMonthlyBackups) {
        for (const backup of oldMonthlyBackups) {
          await this.deleteBackupFile(backup.file_path)
          await this.supabase
            .from('backup_logs')
            .delete()
            .eq('id', backup.id)
          deletedCount++
        }
      }

      console.log(`Cleaned up ${deletedCount} old backups for organization ${organizationId}`)
      return deletedCount
    } catch (error) {
      console.error('Error cleaning up old backups:', error)
      return 0
    }
  }

  /**
   * Remove arquivo de backup do disco
   */
  private async deleteBackupFile(filePath: string | null): Promise<void> {
    if (!filePath) return

    try {
      await fs.unlink(filePath)
    } catch (error) {
      console.error(`Error deleting backup file ${filePath}:`, error)
    }
  }

  /**
   * Registra início do backup
   */
  private async logBackupStart(
    backupId: string,
    organizationId: string,
    type: 'full' | 'incremental' | 'manual'
  ): Promise<void> {
    await this.supabase
      .from('backup_logs')
      .insert({
        id: backupId,
        organization_id: organizationId,
        backup_type: type,
        status: 'running',
        started_at: new Date().toISOString()
      })
  }

  /**
   * Registra conclusão do backup
   */
  private async logBackupComplete(backupId: string, result: BackupResult): Promise<void> {
    await this.supabase
      .from('backup_logs')
      .update({
        status: result.success ? 'completed' : 'failed',
        completed_at: new Date().toISOString(),
        file_path: result.filePath,
        file_size_bytes: result.fileSize,
        tables_backed_up: result.tablesBackedUp,
        error_message: result.error
      })
      .eq('id', backupId)
  }

  /**
   * Gera ID único para backup
   */
  private generateBackupId(type: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const random = Math.random().toString(36).substr(2, 6)
    return `backup_${type}_${timestamp}_${random}`
  }

  /**
   * Agenda backup automático
   */
  async scheduleAutomaticBackups(): Promise<void> {
    // Esta função seria chamada por um cron job
    console.log('Starting scheduled backup process...')

    try {
      // Buscar todas as organizações ativas
      const { data: organizations } = await this.supabase
        .from('organizations')
        .select('id')

      if (!organizations) return

      for (const org of organizations) {
        try {
          // Backup incremental diário
          await this.createIncrementalBackup(org.id)
          
          // Backup completo semanal (domingo)
          const today = new Date().getDay()
          if (today === 0) { // Domingo
            await this.createFullBackup(org.id)
          }

          // Limpeza de backups antigos
          await this.cleanupOldBackups(org.id)
        } catch (error) {
          console.error(`Error backing up organization ${org.id}:`, error)
        }
      }

      console.log('Scheduled backup process completed')
    } catch (error) {
      console.error('Error in scheduled backup process:', error)
    }
  }
}

export default BackupService