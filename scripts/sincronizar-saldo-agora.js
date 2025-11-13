/**
 * Sincronizar saldo das contas Meta AGORA
 */

async function sincronizar() {
  console.log('🔄 Sincronizando saldo das contas Meta...\n')

  try {
    const response = await fetch('http://localhost:3000/api/balance/sync', {
      method: 'POST'
    })

    const data = await response.json()

    if (response.ok) {
      console.log('✅ Sincronização concluída!')
      console.log(`   Contas sincronizadas: ${data.synced}`)
      console.log(`   Erros: ${data.errors}`)
      console.log(`   Mensagem: ${data.message}`)
    } else {
      console.error('❌ Erro na sincronização:')
      console.error(JSON.stringify(data, null, 2))
    }

  } catch (error) {
    console.error('❌ Erro:', error.message)
  }
}

sincronizar()
