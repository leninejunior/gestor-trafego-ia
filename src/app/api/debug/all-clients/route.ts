import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    console.log('🔍 [DEBUG ALL CLIENTS] Listando todos os clientes...')

    // Buscar todos os clientes
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false })

    console.log('👥 [DEBUG ALL CLIENTS] Total de clientes:', clients?.length || 0)

    if (clientsError) {
      console.error('❌ [DEBUG ALL CLIENTS] Erro:', clientsError)
      return NextResponse.json({ error: 'Erro ao buscar clientes', details: clientsError })
    }

    // Buscar todas as conexões Meta
    const { data: connections, error: connectionsError } = await supabase
      .from('client_meta_connections')
      .select('*')
      .order('created_at', { ascending: false })

    console.log('🔗 [DEBUG ALL CLIENTS] Total de conexões:', connections?.length || 0)

    return NextResponse.json({
      clients: clients || [],
      connections: connections || [],
      summary: {
        total_clients: clients?.length || 0,
        total_connections: connections?.length || 0,
        active_connections: connections?.filter(c => c.is_active).length || 0
      }
    })

  } catch (error) {
    console.error('💥 [DEBUG ALL CLIENTS] Erro:', error)
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}