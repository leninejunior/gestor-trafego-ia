import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const debug: any = {}

    // Verificar estrutura das tabelas
    const tables = ['clients', 'organizations', 'client_meta_connections', 'meta_campaigns']
    
    for (const table of tables) {
      try {
        // Tentar fazer um select simples para ver se a tabela existe
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1)
        
        debug[table] = {
          exists: true,
          error: error,
          sampleData: data
        }
      } catch (error) {
        debug[table] = {
          exists: false,
          error: error
        }
      }
    }

    // Verificar usuários auth
    const { data: authUsers, error: authError } = await supabase
      .from('auth.users')
      .select('id, email')
      .limit(3)

    debug.authUsers = {
      data: authUsers,
      error: authError
    }

    return NextResponse.json(debug)

  } catch (error) {
    console.error('Error in debug API:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}