/**
 * Script para sincronizar saldos das contas Meta AGORA
 */

require('dotenv').config()

const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

async function sincronizarSaldos() {
  console.log('🔄 Sincronizando saldos das contas Meta...\n')

  try {
    const response = await fetch(`${NEXT_PUBLIC_APP_URL}/api/balance/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('❌ Erro ao sincronizar:', error)
      return
    }

    const result = await response.json()
    console.log('✅ Sincronização concluída!')
    console.log(`   - Contas sincronizadas: ${result.synced}`)
    console.log(`   - Erros: ${result.errors}`)
    console.log(`   - Mensagem: ${result.message}`)
    console.log(`   - Timestamp: ${result.timestamp}`)

    if (result.synced > 0) {
      console.log('\n✅ Saldos sincronizados com sucesso!')
      console.log('\n💡 Acesse o dashboard para ver os saldos:')
      console.log(`   ${NEXT_PUBLIC_APP_URL}/dashboard`)
    } else {
      console.log('\n⚠️ Nenhuma conta foi sincronizada')
      console.log('   Verifique se há conexões Meta ativas')
    }

  } catch (error) {
    console.error('❌ Erro:', error.message)
  }
}

sincronizarSaldos()
