import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasOrganizationAccess } from '@/lib/postgres/meta-connections-repository'
import {
  getAdStatusContextByExternalId,
  updateMetaAdStatusByExternalId,
} from '@/lib/postgres/meta-hierarchy-repository'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ adId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { adId } = await params
    const { status } = await request.json()

    if (!status || !['ACTIVE', 'PAUSED'].includes(status)) {
      return NextResponse.json({
        error: 'Status inválido. Use ACTIVE ou PAUSED'
      }, { status: 400 })
    }

    // Buscar o anúncio e sua conexão (Postgres direto)
    const adContext = await getAdStatusContextByExternalId(adId)
    if (!adContext) {
      return NextResponse.json({
        error: 'Anúncio não encontrado'
      }, { status: 404 })
    }

    if (!adContext.org_id || !(await hasOrganizationAccess(user.id, adContext.org_id))) {
      return NextResponse.json({
        error: 'Anúncio não encontrado'
      }, { status: 404 })
    }

    if (!adContext.access_token) {
      return NextResponse.json({
        error: 'Token de acesso não encontrado para esta conexão'
      }, { status: 400 })
    }

    if (!adContext.is_active) {
      return NextResponse.json({
        error: 'Conexão Meta Ads não está ativa'
      }, { status: 400 })
    }

    // Atualizar status na Meta API
    const metaApiUrl = `https://graph.facebook.com/v18.0/${adId}`
    const response = await fetch(metaApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status,
        access_token: adContext.access_token
      })
    })

    const data = await response.json() as { error?: { message?: string; [key: string]: unknown } }

    if (!response.ok || data.error) {
      console.error('Erro da Meta API:', data.error)
      return NextResponse.json({
        error: data.error?.message || 'Erro ao atualizar status na Meta API',
        details: data.error
      }, { status: 400 })
    }

    // Atualizar no banco de dados local
    await updateMetaAdStatusByExternalId(adId, status)

    return NextResponse.json({
      success: true,
      message: `Anúncio ${status === 'ACTIVE' ? 'ativado' : 'pausado'} com sucesso`
    })

  } catch (error) {
    console.error('Erro ao atualizar status do anúncio:', error)
    return NextResponse.json({
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}
