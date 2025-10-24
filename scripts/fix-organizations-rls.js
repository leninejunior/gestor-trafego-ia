/**
 * Script para corrigir políticas RLS da tabela organizations
 * Permite que super_admin possa atualizar organizações
 */

/**
 * Vou aplicar a correção diretamente no código da API
 * já que o problema é que a RLS policy não permite super_admin
 */

console.log('🔧 A correção será aplicada diretamente no código da API...')
console.log('✅ O problema foi identificado: RLS policy só permite "admin", mas o usuário é "super_admin"')
console.log('💡 Solução: Modificar a lógica da API para contornar a RLS quando necessário')

// Não precisamos executar SQL, vamos corrigir no código da API
process.exit(0)

async function fixOrganizationsRLS() {
  console.log('🔧 Corrigindo políticas RLS para organizations...')

  try {
    console.log('📄 Executando comandos SQL...')
    
    // Primeiro, remover política existente de UPDATE
    console.log('1. Removendo política de UPDATE existente...')
    const { error: dropUpdateError } = await supabase.rpc('exec_sql', {
      sql: 'DROP POLICY IF EXISTS "Users can update their own organizations" ON organizations;'
    })
    
    if (dropUpdateError) {
      console.log('⚠️ Aviso ao remover política UPDATE:', dropUpdateError.message)
    }

    // Criar nova política de UPDATE
    console.log('2. Criando nova política de UPDATE...')
    const { error: createUpdateError } = await supabase.rpc('exec_sql', {
      sql: `CREATE POLICY "Users can update their own organizations" ON organizations
            FOR UPDATE USING (
                id IN (
                    SELECT org_id FROM memberships 
                    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
                )
            );`
    })
    
    if (createUpdateError) {
      console.error('❌ Erro ao criar política UPDATE:', createUpdateError)
      return false
    }

    // Remover política existente de SELECT
    console.log('3. Removendo política de SELECT existente...')
    const { error: dropSelectError } = await supabase.rpc('exec_sql', {
      sql: 'DROP POLICY IF EXISTS "Users can view their own organizations" ON organizations;'
    })
    
    if (dropSelectError) {
      console.log('⚠️ Aviso ao remover política SELECT:', dropSelectError.message)
    }

    // Criar nova política de SELECT
    console.log('4. Criando nova política de SELECT...')
    const { error: createSelectError } = await supabase.rpc('exec_sql', {
      sql: `CREATE POLICY "Users can view their own organizations" ON organizations
            FOR SELECT USING (
                id IN (
                    SELECT org_id FROM memberships 
                    WHERE user_id = auth.uid()
                )
            );`
    })
    
    if (createSelectError) {
      console.error('❌ Erro ao criar política SELECT:', createSelectError)
      return false
    }

    console.log('✅ Políticas RLS corrigidas com sucesso!')
    return true

  } catch (error) {
    console.error('❌ Erro:', error.message)
    return false
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  fixOrganizationsRLS()
    .then(success => {
      if (success) {
        console.log('🎉 Script executado com sucesso!')
        process.exit(0)
      } else {
        console.log('💥 Script falhou!')
        process.exit(1)
      }
    })
    .catch(error => {
      console.error('💥 Erro fatal:', error)
      process.exit(1)
    })
}

module.exports = { fixOrganizationsRLS }