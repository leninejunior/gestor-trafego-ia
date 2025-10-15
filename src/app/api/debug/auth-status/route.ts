import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    console.log('🔍 [AUTH STATUS] Verificando autenticação...')
    console.log('👤 [AUTH STATUS] Usuário:', user?.email || 'Não autenticado')
    console.log('❌ [AUTH STATUS] Erro:', authError?.message || 'Nenhum erro')
    
    return NextResponse.json({
      authenticated: !!user,
      user: user ? {
        id: user.id,
        email: user.email,
        created_at: user.created_at
      } : null,
      error: authError?.message || null,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('💥 [AUTH STATUS] Erro:', error)
    return NextResponse.json({ 
      authenticated: false,
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}