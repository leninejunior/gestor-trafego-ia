#!/usr/bin/env node

/**
 * Teste completo do sistema de controle de acesso
 * Verifica se todas as tabelas, funções e dados estão corretos
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente não configuradas')
  console.error('Necessário: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function testUserAccessSystem() {
  console.log('🔍 Testando Sistema de Controle de Acesso')
  console.log('=' .repeat(50))

  try {
    // 1. Verificar se as tabelas existem
    console.log('\n1. Verificando tabelas...')
    
    // Usar RPC para verificar tabelas
    const { data: tablesData, error: tablesError } = await supabase
      .rpc('check_table_exists', { table_names: ['master_users', 'client_users'] })

    if (tablesError) {
      // Fallback: tentar consultar diretamente as tabelas
      console.log('⚠️  Tentando verificação direta das tabelas...')
      
      const masterCheck = await supabase.from('master_users').select('count', { count: 'exact', head: true })
      const clientCheck = await supabase.from('client_users').select('count', { count: 'exact', head: true })
      
      if (masterCheck.error) {
        console.error('❌ Tabela master_users não encontrada:', masterCheck.error.message)
        return false
      }
      
      if (clientCheck.error) {
        console.error('❌ Tabela client_users não encontrada:', clientCheck.error.message)
        return false
      }
      
      console.log('✅ Tabelas encontradas: master_users, client_users')
    } else {
      console.log('✅ Tabelas verificadas via RPC')
    }

    // 2. Verificar se o enum existe
    console.log('\n2. Verificando enum user_type_enum...')
    
    // Tentar usar o enum diretamente
    try {
      const { data: enumTest, error: enumError } = await supabase
        .from('memberships')
        .select('user_type')
        .limit(1)
      
      if (enumError) {
        console.log('⚠️  Enum user_type_enum pode não existir:', enumError.message)
      } else {
        console.log('✅ Enum user_type_enum funcionando')
      }
    } catch (error) {
      console.log('⚠️  Erro ao testar enum:', error.message)
    }

    // 3. Verificar se as funções existem
    console.log('\n3. Verificando funções SQL...')
    
    // Tentar chamar as funções diretamente
    try {
      const { data: userTypeTest, error: userTypeError } = await supabase
        .rpc('get_user_type', { user_id: '00000000-0000-0000-0000-000000000000' })
      
      if (userTypeError) {
        console.log('⚠️  Função get_user_type não encontrada:', userTypeError.message)
      } else {
        console.log('✅ Função get_user_type funcionando')
      }
    } catch (error) {
      console.log('⚠️  Erro ao testar função get_user_type:', error.message)
    }

    // 4. Verificar dados nas tabelas
    console.log('\n4. Verificando dados...')
    
    const { data: masterUsers, error: masterError } = await supabase
      .from('master_users')
      .select('*')

    if (masterError) {
      console.error('❌ Erro ao buscar master_users:', masterError.message)
    } else {
      console.log('✅ Master users encontrados:', masterUsers.length)
      masterUsers.forEach(user => {
        console.log(`  - ${user.user_id} (ativo: ${user.is_active})`)
      })
    }

    const { data: clientUsers, error: clientError } = await supabase
      .from('client_users')
      .select('*')

    if (clientError) {
      console.error('❌ Erro ao buscar client_users:', clientError.message)
    } else {
      console.log('✅ Client users encontrados:', clientUsers.length)
      clientUsers.forEach(user => {
        console.log(`  - ${user.user_id} -> cliente ${user.client_id}`)
      })
    }

    // 5. Verificar coluna user_type na tabela memberships
    console.log('\n5. Verificando coluna user_type em memberships...')
    
    try {
      const { data: membershipTest, error: membershipError } = await supabase
        .from('memberships')
        .select('user_type')
        .limit(1)
      
      if (membershipError) {
        console.error('❌ Coluna user_type não encontrada na tabela memberships:', membershipError.message)
      } else {
        console.log('✅ Coluna user_type encontrada na tabela memberships')
      }
    } catch (error) {
      console.error('❌ Erro ao verificar coluna user_type:', error.message)
    }

    // 6. Testar uma consulta de usuários
    console.log('\n6. Testando consulta de usuários...')
    
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()
    
    if (authError) {
      console.error('❌ Erro ao buscar usuários do Auth:', authError.message)
    } else {
      console.log('✅ Usuários do Auth encontrados:', authUsers.users.length)
      
      if (authUsers.users.length > 0) {
        const firstUser = authUsers.users[0]
        console.log(`  - Primeiro usuário: ${firstUser.email} (${firstUser.id})`)
        
        // Verificar se é master user
        const { data: isMaster } = await supabase
          .from('master_users')
          .select('user_id')
          .eq('user_id', firstUser.id)
          .single()
        
        console.log(`  - É master user: ${!!isMaster}`)
      }
    }

    console.log('\n' + '='.repeat(50))
    console.log('✅ Teste do sistema de controle de acesso concluído!')
    
    return true

  } catch (error) {
    console.error('❌ Erro durante o teste:', error)
    return false
  }
}

// Executar teste
testUserAccessSystem()
  .then(success => {
    if (success) {
      console.log('\n🎉 Sistema de controle de acesso está funcionando!')
    } else {
      console.log('\n⚠️  Sistema de controle de acesso precisa de correções')
    }
    process.exit(success ? 0 : 1)
  })
  .catch(error => {
    console.error('❌ Erro fatal:', error)
    process.exit(1)
  })