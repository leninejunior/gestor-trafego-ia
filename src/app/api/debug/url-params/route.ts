import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const params = {
      access_token: searchParams.get('access_token'),
      client_id: searchParams.get('client_id'),
      all_params: Object.fromEntries(searchParams.entries())
    }
    
    console.log('🔍 [URL DEBUG] Parâmetros recebidos:', params)
    
    return NextResponse.json({
      success: true,
      params,
      url: request.url,
      message: 'Parâmetros da URL capturados com sucesso'
    })
    
  } catch (error) {
    console.error('💥 [URL DEBUG] Erro:', error)
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}