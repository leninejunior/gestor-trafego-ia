import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = await createClient()
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🔗 [CREATE COAN] Criando conexão para Coan Consultoria...')

    // Buscar o cliente Coan Consultoria
    const { data: coanClient, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('name', 'Coan Consultoria')
      .single()

    if (clientError || !coanClient) {
      console.error('❌ [CREATE COAN] Cliente Coan não encontrado:', clientError)
      return NextResponse.json({ 
        error: 'Cliente Coan Consultoria não encontrado',
        details: clientError?.message 
      })
    }

    console.log('✅ [CREATE COAN] Cliente encontrado:', coanClient.name)

    // Verificar se já existe uma conexão ativa
    const { data: existingConnection } = await supabase
      .from('client_meta_connections')
      .select('*')
      .eq('client_id', coanClient.id)
      .eq('is_active', true)
      .single()

    if (existingConnection) {
      console.log('⚠️ [CREATE COAN] Conexão já existe:', existingConnection.account_name)
      return NextResponse.json({
        message: 'Conexão já existe para Coan Consultoria',
        connection: existingConnection
      })
    }

    // Criar nova conexão usando o mesmo token do Luxo Verde (temporário)
    const { data: luxoConnection } = await supabase
      .from('client_meta_connections')
      .select('access_token')
      .eq('is_active', true)
      .single()

    if (!luxoConnection) {
      return NextResponse.json({ 
        error: 'Nenhuma conexão ativa encontrada para copiar o token' 
      })
    }

    // Criar conexão para Coan (você precisará ajustar o ad_account_id real)
    const newConnection = {
      client_id: coanClient.id,
      ad_account_id: 'act_COAN_ACCOUNT_ID', // VOCÊ PRECISA SUBSTITUIR PELO ID REAL
      access_token: luxoConnection.access_token, // Temporário - use o mesmo token
      account_name: 'Conta Meta - Coan Consultoria',
      currency: 'BRL',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data: createdConnection, error: createError } = await supabase
      .from('client_meta_connections')
      .insert(newConnection)
      .select()
      .single()

    if (createError) {
      console.error('❌ [CREATE COAN] Erro ao criar conexão:', createError)
      return NextResponse.json({ 
        error: 'Erro ao criar conexão',
        details: createError.message 
      })
    }

    console.log('✅ [CREATE COAN] Conexão criada com sucesso!')

    return NextResponse.json({
      success: true,
      message: 'Conexão criada para Coan Consultoria',
      connection: createdConnection,
      note: 'IMPORTANTE: Você precisa atualizar o ad_account_id com o ID real da conta Meta do Coan'
    })

  } catch (error) {
    console.error('💥 [CREATE COAN] Erro:', error)
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}