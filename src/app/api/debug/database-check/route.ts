import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    console.log('🔍 [DATABASE CHECK] Verificando estrutura do banco...')

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    console.log('👤 [DATABASE CHECK] Usuário autenticado:', user?.email || 'Não autenticado')

    // Verificar tabelas existentes
    const tables = ['clients', 'client_meta_connections', 'meta_campaigns', 'users', 'organizations']
    const tableResults = {}

    for (const table of tables) {
      try {
        const { data, error, count } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true })

        tableResults[table] = {
          exists: !error,
          count: count || 0,
          error: error?.message || null
        }

        console.log(`📊 [DATABASE CHECK] Tabela ${table}: ${count || 0} registros`)
      } catch (tableError) {
        tableResults[table] = {
          exists: false,
          count: 0,
          error: tableError instanceof Error ? tableError.message : 'Unknown error'
        }
        console.error(`❌ [DATABASE CHECK] Erro na tabela ${table}:`, tableError)
      }
    }

    // Verificar se há dados de usuários
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, role')
      .limit(5)

    console.log('👥 [DATABASE CHECK] Usuários encontrados:', users?.length || 0)

    return NextResponse.json({
      user: {
        authenticated: !!user,
        email: user?.email,
        id: user?.id
      },
      tables: tableResults,
      sampleUsers: users || [],
      authError: authError?.message || null
    })

  } catch (error) {
    console.error('💥 [DATABASE CHECK] Erro geral:', error)
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}