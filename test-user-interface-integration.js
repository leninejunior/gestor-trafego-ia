#!/usr/bin/env node

/**
 * Teste de integração da interface de usuários
 * Verifica se a API está retornando dados corretos para a interface
 */

const https = require('https')
const http = require('http')

const BASE_URL = 'http://localhost:3000'

async function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const client = urlObj.protocol === 'https:' ? https : http
    
    const req = client.get(url, (res) => {
      let data = ''
      
      res.on('data', (chunk) => {
        data += chunk
      })
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data)
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data: jsonData })
        } catch (error) {
          resolve({ ok: false, status: res.statusCode, data: data })
        }
      })
    })
    
    req.on('error', (error) => {
      reject(error)
    })
    
    req.setTimeout(10000, () => {
      req.destroy()
      reject(new Error('Request timeout'))
    })
  })
}

async function testUserInterface() {
  console.log('🔍 Testando Integração da Interface de Usuários')
  console.log('=' .repeat(50))

  try {
    // 1. Testar API simple-test
    console.log('\n1. Testando API /api/admin/users/simple-test...')
    
    const response = await makeRequest(`${BASE_URL}/api/admin/users/simple-test`)
    
    if (!response.ok) {
      console.error('❌ API retornou erro:', response.status)
      console.error('Detalhes:', response.data)
      return false
    }

    const data = response.data
    
    console.log('✅ API respondeu com sucesso')
    console.log('📊 Estatísticas:')
    console.log(`  - Total de usuários: ${data.users?.length || 0}`)
    console.log(`  - Master users: ${data.users?.filter(u => u.user_type === 'master').length || 0}`)
    console.log(`  - Regular users: ${data.users?.filter(u => u.user_type === 'regular').length || 0}`)
    console.log(`  - Client users: ${data.users?.filter(u => u.user_type === 'client').length || 0}`)
    
    if (data.stats) {
      console.log('📈 Stats da API:')
      console.log(`  - Total: ${data.stats.total}`)
      console.log(`  - Ativos: ${data.stats.active}`)
      console.log(`  - Super Admins: ${data.stats.superAdmins}`)
    }

    // 2. Verificar estrutura dos dados
    console.log('\n2. Verificando estrutura dos dados...')
    
    if (!data.users || !Array.isArray(data.users)) {
      console.error('❌ Campo "users" não é um array')
      return false
    }

    if (data.users.length === 0) {
      console.log('⚠️  Nenhum usuário encontrado')
      return true
    }

    const firstUser = data.users[0]
    const requiredFields = ['id', 'email', 'first_name', 'last_name', 'user_type', 'memberships']
    
    for (const field of requiredFields) {
      if (!(field in firstUser)) {
        console.error(`❌ Campo obrigatório "${field}" não encontrado no usuário`)
        return false
      }
    }

    console.log('✅ Estrutura dos dados está correta')

    // 3. Verificar tipos de usuário
    console.log('\n3. Verificando tipos de usuário...')
    
    const userTypes = [...new Set(data.users.map(u => u.user_type))]
    console.log('✅ Tipos encontrados:', userTypes)

    const validTypes = ['master', 'regular', 'client']
    const invalidTypes = userTypes.filter(type => !validTypes.includes(type))
    
    if (invalidTypes.length > 0) {
      console.error('❌ Tipos inválidos encontrados:', invalidTypes)
      return false
    }

    // 4. Verificar memberships
    console.log('\n4. Verificando memberships...')
    
    const usersWithMemberships = data.users.filter(u => u.memberships && u.memberships.length > 0)
    console.log(`✅ Usuários com memberships: ${usersWithMemberships.length}/${data.users.length}`)

    if (usersWithMemberships.length > 0) {
      const firstMembership = usersWithMemberships[0].memberships[0]
      const membershipFields = ['id', 'role', 'status', 'user_type']
      
      for (const field of membershipFields) {
        if (!(field in firstMembership)) {
          console.error(`❌ Campo "${field}" não encontrado no membership`)
          return false
        }
      }
      
      console.log('✅ Estrutura dos memberships está correta')
    }

    // 5. Verificar debug info
    console.log('\n5. Verificando informações de debug...')
    
    if (data.debug) {
      console.log('✅ Debug info presente:')
      console.log(`  - Timestamp: ${data.debug.timestamp}`)
      console.log(`  - Total Auth Users: ${data.debug.totalAuthUsers}`)
      console.log(`  - Master Users Found: ${data.debug.masterUsersFound}`)
      console.log(`  - Client Users Found: ${data.debug.clientUsersFound}`)
      
      if (data.debug.masterError) {
        console.log(`  - Master Error: ${data.debug.masterError}`)
      }
      
      if (data.debug.clientError) {
        console.log(`  - Client Error: ${data.debug.clientError}`)
      }
    }

    console.log('\n' + '='.repeat(50))
    console.log('✅ Teste de integração da interface concluído com sucesso!')
    
    return true

  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message)
    return false
  }
}

// Executar teste
testUserInterface()
  .then(success => {
    if (success) {
      console.log('\n🎉 Interface de usuários está funcionando corretamente!')
      console.log('🔗 Acesse: http://localhost:3000/admin/users')
    } else {
      console.log('\n⚠️  Interface de usuários precisa de correções')
    }
    process.exit(success ? 0 : 1)
  })
  .catch(error => {
    console.error('❌ Erro fatal:', error)
    process.exit(1)
  })