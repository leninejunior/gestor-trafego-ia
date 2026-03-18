/**
 * Script para Testar Sincronização de Saldo
 * Simula uma chamada à API de sincronização
 */

require('dotenv').config()

async function testBalanceSync() {
  console.log('🔄 TESTE DE SINCRONIZAÇÃO DE SALDO\n')
  console.log('=' .repeat(60))

  try {
    // Simular chamada à API de sincronização
    const response = await fetch('http://localhost:3000/api/balance/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const error = await response.json()
      console.log('❌ Erro na sincronização:')
      console.log(JSON.stringify(error, null, 2))
      return
    }

    const result = await response.json()
    console.log('✅ Sincronização concluída!\n')
    console.log('📊 Resultado:')
    console.log(`   - Contas sincronizadas: ${result.synced}`)
    console.log(`   - Erros: ${result.errors}`)
    console.log(`   - Timestamp: ${new Date(result.timestamp).toLocaleString('pt-BR')}`)
    console.log(`\n💬 Mensagem: ${result.message}`)

  } catch (error) {
    console.error('❌ Erro ao testar sincronização:', error.message)
    console.log('\n💡 Certifique-se de que o servidor está rodando:')
    console.log('   npm run dev')
  }

  console.log('\n' + '='.repeat(60))
}

testBalanceSync()
  .then(() => {
    console.log('\n✅ Teste concluído!')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n❌ Erro:', error)
    process.exit(1)
  })
