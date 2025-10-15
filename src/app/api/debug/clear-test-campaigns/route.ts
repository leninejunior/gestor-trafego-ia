import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE() {
  try {
    const supabase = await createClient()
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🗑️ [CLEAR TEST] Limpando campanhas de teste...')

    // Deletar todas as campanhas que começam com "test_" ou "Campanha Teste"
    const { data: deletedCampaigns, error: deleteError } = await supabase
      .from('meta_campaigns')
      .delete()
      .or('external_id.like.test_%,name.like.%Teste%,name.like.%Test%')

    if (deleteError) {
      console.error('❌ [CLEAR TEST] Erro ao deletar:', deleteError)
      return NextResponse.json({ 
        error: 'Erro ao limpar campanhas de teste',
        details: deleteError.message 
      })
    }

    console.log('✅ [CLEAR TEST] Campanhas de teste removidas')

    // Verificar quantas campanhas restaram
    const { data: remainingCampaigns, error: countError } = await supabase
      .from('meta_campaigns')
      .select('id', { count: 'exact', head: true })

    return NextResponse.json({
      success: true,
      message: 'Campanhas de teste removidas com sucesso',
      remainingCampaigns: remainingCampaigns || 0
    })

  } catch (error) {
    console.error('💥 [CLEAR TEST] Erro:', error)
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}