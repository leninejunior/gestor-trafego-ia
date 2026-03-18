/**
 * Cleanup Service - Exemplos de Uso
 * 
 * Este arquivo contém exemplos práticos de como usar o CleanupService
 * Não é um arquivo de teste, mas sim exemplos de código para referência
 */

import { cleanupService } from '../cleanup-service';

/**
 * Exemplo 1: Verificar saúde do sistema de limpeza
 */
export async function example1_CheckSystemHealth() {
  console.log('=== Exemplo 1: Verificar Saúde do Sistema ===\n');
  
  const stats = await cleanupService.getCleanupStats();
  
  console.log(`Total de clientes: ${stats.total_clients}`);
  console.log(`Total de partições: ${stats.total_partitions}`);
  console.log(`Partição mais antiga: ${stats.oldest_partition_date}`);
  console.log(`Partição mais recente: ${stats.newest_partition_date}`);
  
  // Verificar se há partições suficientes
  if (stats.total_partitions < 3) {
    console.warn('⚠️ Poucas partições! Recomenda-se criar mais.');
  } else {
    console.log('✅ Sistema com partições adequadas');
  }
  
  return stats;
}

/**
 * Exemplo 2: Criar partições para os próximos meses
 */
export async function example2_CreatePartitions() {
  console.log('=== Exemplo 2: Criar Partições ===\n');
  
  // Criar partições para os próximos 3 meses
  const partitions = await cleanupService.createMonthlyPartitions(3);
  
  const newPartitions = partitions.filter(p => p.created);
  const existingPartitions = partitions.filter(p => !p.created);
  
  console.log(`Total verificado: ${partitions.length}`);
  console.log(`Novas criadas: ${newPartitions.length}`);
  console.log(`Já existentes: ${existingPartitions.length}`);
  
  if (newPartitions.length > 0) {
    console.log('\nPartições criadas:');
    newPartitions.forEach(p => {
      console.log(`  - ${p.partition_name} (${p.start_date.toISOString().split('T')[0]} a ${p.end_date.toISOString().split('T')[0]})`);
    });
  }
  
  return partitions;
}

/**
 * Exemplo 3: Limpar dados expirados de um cliente específico
 */
export async function example3_CleanupSingleClient(clientId: string) {
  console.log('=== Exemplo 3: Limpar Cliente Específico ===\n');
  
  console.log(`Cliente ID: ${clientId}`);
  
  const result = await cleanupService.deleteExpiredData(clientId);
  
  console.log(`\nResultados:`);
  console.log(`  Registros removidos: ${result.records_deleted}`);
  console.log(`  Período de retenção: ${result.retention_days} dias`);
  console.log(`  Data de corte: ${result.cutoff_date.toISOString().split('T')[0]}`);
  
  if (result.records_deleted > 0) {
    console.log(`✅ Limpeza concluída com sucesso`);
  } else {
    console.log(`ℹ️ Nenhum dado expirado encontrado`);
  }
  
  return result;
}

/**
 * Exemplo 4: Limpar dados de todos os clientes
 */
export async function example4_CleanupAllClients() {
  console.log('=== Exemplo 4: Limpar Todos os Clientes ===\n');
  
  const results = await cleanupService.deleteExpiredDataForAllClients();
  
  const totalDeleted = results.reduce((sum, r) => sum + r.records_deleted, 0);
  const clientsWithDeletions = results.filter(r => r.records_deleted > 0).length;
  
  console.log(`Total de clientes processados: ${results.length}`);
  console.log(`Clientes com dados removidos: ${clientsWithDeletions}`);
  console.log(`Total de registros removidos: ${totalDeleted}`);
  
  // Agrupar por período de retenção
  const byRetention = results.reduce((acc, r) => {
    const key = `${r.retention_days} dias`;
    if (!acc[key]) {
      acc[key] = { count: 0, deleted: 0 };
    }
    acc[key].count++;
    acc[key].deleted += r.records_deleted;
    return acc;
  }, {} as Record<string, { count: number; deleted: number }>);
  
  console.log('\nPor período de retenção:');
  Object.entries(byRetention).forEach(([retention, data]) => {
    console.log(`  ${retention}: ${data.count} clientes, ${data.deleted} registros removidos`);
  });
  
  return results;
}

/**
 * Exemplo 5: Arquivar partições antigas
 */
export async function example5_ArchiveOldPartitions() {
  console.log('=== Exemplo 5: Arquivar Partições Antigas ===\n');
  
  // Arquivar partições com mais de 12 meses
  const archived = await cleanupService.archiveOldPartitions(12);
  
  const successful = archived.filter(a => a.archived);
  const failed = archived.filter(a => !a.archived);
  
  console.log(`Total processado: ${archived.length}`);
  console.log(`Arquivadas com sucesso: ${successful.length}`);
  console.log(`Falhas: ${failed.length}`);
  
  if (successful.length > 0) {
    console.log('\nPartições arquivadas:');
    successful.forEach(a => {
      console.log(`  ✅ ${a.partition_name}`);
    });
  }
  
  if (failed.length > 0) {
    console.log('\nFalhas ao arquivar:');
    failed.forEach(a => {
      console.log(`  ❌ ${a.partition_name}: ${a.error}`);
    });
  }
  
  return archived;
}

/**
 * Exemplo 6: Relatório completo de limpeza
 */
export async function example6_GenerateCleanupReport() {
  console.log('=== Exemplo 6: Relatório Completo de Limpeza ===\n');
  
  // 1. Estatísticas gerais
  const stats = await cleanupService.getCleanupStats();
  
  // 2. Criar partições
  const partitions = await cleanupService.createMonthlyPartitions(3);
  
  // 3. Limpar dados
  const cleanupResults = await cleanupService.deleteExpiredDataForAllClients();
  
  const report = {
    timestamp: new Date().toISOString(),
    system: {
      total_clients: stats.total_clients,
      total_partitions: stats.total_partitions,
      oldest_partition: stats.oldest_partition_date,
      newest_partition: stats.newest_partition_date
    },
    partitions: {
      checked: partitions.length,
      created: partitions.filter(p => p.created).length,
      existing: partitions.filter(p => !p.created).length
    },
    cleanup: {
      clients_processed: cleanupResults.length,
      clients_with_deletions: cleanupResults.filter(r => r.records_deleted > 0).length,
      total_records_deleted: cleanupResults.reduce((sum, r) => sum + r.records_deleted, 0),
      by_retention: cleanupResults.reduce((acc, r) => {
        const key = `${r.retention_days}d`;
        acc[key] = (acc[key] || 0) + r.records_deleted;
        return acc;
      }, {} as Record<string, number>)
    }
  };
  
  console.log('Relatório de Limpeza:');
  console.log(JSON.stringify(report, null, 2));
  
  return report;
}

/**
 * Exemplo 7: Monitorar clientes com mais dados expirados
 */
export async function example7_FindClientsWithMostExpiredData() {
  console.log('=== Exemplo 7: Clientes com Mais Dados Expirados ===\n');
  
  const results = await cleanupService.deleteExpiredDataForAllClients();
  
  // Ordenar por registros removidos (decrescente)
  const sorted = results
    .filter(r => r.records_deleted > 0)
    .sort((a, b) => b.records_deleted - a.records_deleted)
    .slice(0, 10); // Top 10
  
  console.log('Top 10 clientes com mais dados expirados:\n');
  sorted.forEach((r, index) => {
    console.log(`${index + 1}. Cliente ${r.client_id}`);
    console.log(`   Registros removidos: ${r.records_deleted}`);
    console.log(`   Retenção: ${r.retention_days} dias`);
    console.log(`   Data de corte: ${r.cutoff_date.toISOString().split('T')[0]}\n`);
  });
  
  return sorted;
}

/**
 * Exemplo 8: Verificar se cliente precisa de limpeza
 */
export async function example8_CheckIfClientNeedsCleanup(clientId: string) {
  console.log('=== Exemplo 8: Verificar Necessidade de Limpeza ===\n');
  
  console.log(`Cliente ID: ${clientId}\n`);
  
  // Executar limpeza (modo dry-run simulado)
  const result = await cleanupService.deleteExpiredData(clientId);
  
  if (result.records_deleted > 0) {
    console.log(`⚠️ Cliente precisa de limpeza`);
    console.log(`   ${result.records_deleted} registros expirados`);
    console.log(`   Retenção: ${result.retention_days} dias`);
    console.log(`   Dados anteriores a: ${result.cutoff_date.toISOString().split('T')[0]}`);
  } else {
    console.log(`✅ Cliente não precisa de limpeza`);
    console.log(`   Todos os dados estão dentro do período de retenção`);
  }
  
  return result;
}

/**
 * Exemplo 9: Executar limpeza completa (como o cron job)
 */
export async function example9_FullCleanupJob() {
  console.log('=== Exemplo 9: Limpeza Completa (Simulação Cron) ===\n');
  
  const startTime = Date.now();
  
  try {
    // Passo 1: Criar partições
    console.log('Passo 1: Criando partições...');
    const partitions = await cleanupService.createMonthlyPartitions(3);
    console.log(`✅ ${partitions.filter(p => p.created).length} partições criadas\n`);
    
    // Passo 2: Limpar dados
    console.log('Passo 2: Limpando dados expirados...');
    const cleanupResults = await cleanupService.deleteExpiredDataForAllClients();
    const totalDeleted = cleanupResults.reduce((sum, r) => sum + r.records_deleted, 0);
    console.log(`✅ ${totalDeleted} registros removidos de ${cleanupResults.length} clientes\n`);
    
    // Passo 3: Estatísticas
    console.log('Passo 3: Coletando estatísticas...');
    const stats = await cleanupService.getCleanupStats();
    console.log(`✅ Sistema com ${stats.total_clients} clientes e ${stats.total_partitions} partições\n`);
    
    const duration = Date.now() - startTime;
    
    console.log(`\n✅ Limpeza completa concluída em ${duration}ms`);
    
    return {
      success: true,
      duration_ms: duration,
      partitions: partitions.filter(p => p.created).length,
      records_deleted: totalDeleted,
      clients_processed: cleanupResults.length
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`\n❌ Erro na limpeza: ${error}`);
    
    return {
      success: false,
      duration_ms: duration,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Exemplo 10: Comparar antes e depois da limpeza
 */
export async function example10_CompareBeforeAfter(clientId: string) {
  console.log('=== Exemplo 10: Comparar Antes e Depois ===\n');
  
  console.log(`Cliente ID: ${clientId}\n`);
  
  // Antes da limpeza
  console.log('Antes da limpeza:');
  const statsBefore = await cleanupService.getCleanupStats();
  console.log(`  Total de partições: ${statsBefore.total_partitions}`);
  
  // Executar limpeza
  console.log('\nExecutando limpeza...');
  const result = await cleanupService.deleteExpiredData(clientId);
  console.log(`  Registros removidos: ${result.records_deleted}`);
  
  // Depois da limpeza
  console.log('\nDepois da limpeza:');
  const statsAfter = await cleanupService.getCleanupStats();
  console.log(`  Total de partições: ${statsAfter.total_partitions}`);
  
  // Comparação
  console.log('\nComparação:');
  console.log(`  Registros removidos: ${result.records_deleted}`);
  console.log(`  Período de retenção: ${result.retention_days} dias`);
  console.log(`  Data de corte: ${result.cutoff_date.toISOString().split('T')[0]}`);
  
  return {
    before: statsBefore,
    after: statsAfter,
    cleanup: result
  };
}

// Função auxiliar para executar todos os exemplos
export async function runAllExamples() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  Cleanup Service - Exemplos de Uso                    ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  try {
    await example1_CheckSystemHealth();
    console.log('\n' + '─'.repeat(60) + '\n');
    
    await example2_CreatePartitions();
    console.log('\n' + '─'.repeat(60) + '\n');
    
    // Exemplos 3, 8, 10 requerem clientId
    // await example3_CleanupSingleClient('client-id-here');
    
    await example4_CleanupAllClients();
    console.log('\n' + '─'.repeat(60) + '\n');
    
    await example6_GenerateCleanupReport();
    console.log('\n' + '─'.repeat(60) + '\n');
    
    await example7_FindClientsWithMostExpiredData();
    console.log('\n' + '─'.repeat(60) + '\n');
    
    await example9_FullCleanupJob();
    
    console.log('\n✅ Todos os exemplos executados com sucesso!');
    
  } catch (error) {
    console.error('\n❌ Erro ao executar exemplos:', error);
  }
}

