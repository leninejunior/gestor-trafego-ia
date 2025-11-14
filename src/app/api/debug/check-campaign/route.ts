import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams
    const campaignId = searchParams.get('campaignId')

    if (!campaignId) {
      return NextResponse.json({
        error: 'campaignId é obrigatório'
      }, { status: 400 })
    }

    console.log('🔍 DEBUG: Buscando campanha:', campaignId)

    // Buscar todas as campanhas para debug
    const { data: allCampaigns, error: allError } = await supabase
      .from('meta_campaigns')
      .select('id, external_id, name, status')
      .limit(5)

    console.log('📊 DEBUG: Primeiras 5 campanhas:', allCampaigns)

    // Buscar por external_id
    const { data: byExternalId, error: externalIdError } = await supabase
      .from('meta_campaigns')
      .select('*')
      .eq('external_id', campaignId)
      .maybeSingle()

    console.log('📊 DEBUG: Busca por external_id:', { found: !!byExternalId, error: externalIdError })

    // Buscar por id
    const { data: byId, error: idError } = await supabase
      .from('meta_campaigns')
      .select('*')
      .eq('id', campaignId)
      .maybeSingle()

    console.log('📊 DEBUG: Busca por id:', { found: !!byId, error: idError })

    return NextResponse.json({
      campaignId,
      allCampaigns,
      byExternalId,
      byId,
      errors: {
        allError,
        externalIdError,
        idError
      }
    })

  } catch (error) {
    console.error('💥 DEBUG: Erro:', error)
    return NextResponse.json({
      error: 'Erro interno',
      details: error
    }, { status: 500 })
  }
}
