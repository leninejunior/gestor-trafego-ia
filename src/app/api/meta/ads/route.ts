import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams
    const adsetId = searchParams.get('adsetId')
    const clientId = searchParams.get('clientId')
    const adAccountId = searchParams.get('adAccountId')

    if (!adsetId) {
      return NextResponse.json({
        error: 'adsetId é obrigatório'
      }, { status: 400 })
    }

    // Se clientId e adAccountId forem fornecidos, buscar conexão diretamente
    let connection: any = null;
    let adsetInternalId: string | null = null;
    
    if (clientId && adAccountId) {
      const { data: conn, error: connError } = await supabase
        .from('client_meta_connections')
        .select('*')
        .eq('client_id', clientId)
        .eq('ad_account_id', adAccountId)
        .eq('is_active', true)
        .single()

      if (!connError && conn) {
        connection = conn
      }
    }

    // Se não encontrou conexão pelos parâmetros, tentar buscar pelo adset no banco
    if (!connection) {
      const { data: adset, error: adsetError } = await supabase
        .from('meta_adsets')
        .select(`
          id,
          external_id,
          campaign_id,
          meta_campaigns!inner (
            id,
            connection_id,
            client_meta_connections!inner (
              id,
              client_id,
              access_token,
              is_active
            )
          )
        `)
        .eq('external_id', adsetId)
        .single()

      if (adsetError || !adset) {
        return NextResponse.json({
          error: 'Conjunto de anúncios não encontrado e conexão não especificada'
        }, { status: 404 })
      }

      const campaign = adset.meta_campaigns as any
      connection = campaign.client_meta_connections
      adsetInternalId = adset.id
    }

    if (!connection || !connection.is_active) {
      return NextResponse.json({
        error: 'Conexão Meta Ads não está ativa'
      }, { status: 400 })
    }

    // Buscar anúncios da Meta API com campos expandidos
    const metaApiUrl = `https://graph.facebook.com/v18.0/${adsetId}/ads`
    const params = new URLSearchParams({
      access_token: connection.access_token,
      fields: 'id,name,status,creative{id,name,title,body,image_url,thumbnail_url,image_hash,video_id,object_story_spec,effective_object_story_id,asset_feed_spec,call_to_action_type},created_time,updated_time,effective_status'
    })
    
    console.log('🔍 [ADS API] Buscando anúncios do adset:', adsetId)

    const response = await fetch(`${metaApiUrl}?${params}`)
    const data = await response.json()

    console.log('📊 [ADS API] Resposta da Meta:', {
      total: data.data?.length || 0,
      sample: data.data?.[0] ? {
        id: data.data[0].id,
        name: data.data[0].name,
        hasCreative: !!data.data[0].creative,
        creativeFields: data.data[0].creative ? Object.keys(data.data[0].creative) : [],
        creativeDataSample: data.data[0].creative ? {
          id: data.data[0].creative.id,
          hasTitle: !!data.data[0].creative.title,
          hasBody: !!data.data[0].creative.body,
          hasImageUrl: !!data.data[0].creative.image_url,
          hasObjectStorySpec: !!data.data[0].creative.object_story_spec
        } : null
      } : null
    })

    // Log completo do primeiro criativo para debug
    if (data.data?.[0]?.creative) {
      console.log('🔍 [ADS API] Criativo completo (primeiro anúncio):', JSON.stringify(data.data[0].creative, null, 2))
    }

    // Processar anúncios para extrair informações do criativo
    if (data.data && data.data.length > 0) {
      for (const ad of data.data) {
        if (ad.creative) {
          console.log(`🔍 [ADS API] Analisando criativo ${ad.id}:`, {
            hasObjectStorySpec: !!ad.creative.object_story_spec,
            objectStorySpec: ad.creative.object_story_spec,
            directTitle: ad.creative.title,
            directBody: ad.creative.body,
            directImageUrl: ad.creative.image_url
          })

          // Tentar extrair imagem de object_story_spec se image_url não estiver disponível
          if (!ad.creative.image_url && ad.creative.object_story_spec) {
            const spec = ad.creative.object_story_spec
            if (spec.link_data?.picture) {
              ad.creative.image_url = spec.link_data.picture
              console.log(`✅ Imagem extraída de link_data.picture`)
            } else if (spec.photo_data?.url) {
              ad.creative.image_url = spec.photo_data.url
              console.log(`✅ Imagem extraída de photo_data.url`)
            } else if (spec.video_data?.image_url) {
              ad.creative.image_url = spec.video_data.image_url
              console.log(`✅ Imagem extraída de video_data.image_url`)
            }
          }

          // Tentar extrair texto de object_story_spec se body não estiver disponível
          if (!ad.creative.body && ad.creative.object_story_spec) {
            const spec = ad.creative.object_story_spec
            if (spec.link_data?.message) {
              ad.creative.body = spec.link_data.message
              console.log(`✅ Body extraído de link_data.message:`, ad.creative.body.substring(0, 50))
            } else if (spec.photo_data?.message) {
              ad.creative.body = spec.photo_data.message
              console.log(`✅ Body extraído de photo_data.message:`, ad.creative.body.substring(0, 50))
            } else if (spec.video_data?.message) {
              ad.creative.body = spec.video_data.message
              console.log(`✅ Body extraído de video_data.message:`, ad.creative.body.substring(0, 50))
            } else {
              console.log(`⚠️ Nenhum body encontrado em object_story_spec`)
            }
          }

          // Tentar extrair título de object_story_spec se title não estiver disponível
          if (!ad.creative.title && ad.creative.object_story_spec) {
            const spec = ad.creative.object_story_spec
            if (spec.link_data?.name) {
              ad.creative.title = spec.link_data.name
              console.log(`✅ Título extraído de link_data.name:`, ad.creative.title)
            } else if (spec.link_data?.caption) {
              ad.creative.title = spec.link_data.caption
              console.log(`✅ Título extraído de link_data.caption:`, ad.creative.title)
            } else if (spec.link_data?.description) {
              ad.creative.title = spec.link_data.description
              console.log(`✅ Título extraído de link_data.description:`, ad.creative.title)
            } else {
              console.log(`⚠️ Nenhum título encontrado em object_story_spec`)
            }
          }

          console.log(`📝 [ADS API] Criativo processado para ${ad.id}:`, {
            hasImage: !!ad.creative.image_url,
            hasTitle: !!ad.creative.title,
            hasBody: !!ad.creative.body,
            hasVideoId: !!ad.creative.video_id,
            title: ad.creative.title,
            bodyPreview: ad.creative.body?.substring(0, 50)
          })
        }
      }
    }

    if (!response.ok || data.error) {
      console.error('❌ [ADS API] Erro da Meta API:', data.error)
      return NextResponse.json({
        error: data.error?.message || 'Erro ao buscar anúncios na Meta API',
        details: data.error
      }, { status: 400 })
    }

    // Sincronizar com banco de dados local (apenas se tivermos o adsetInternalId)
    if (data.data && data.data.length > 0 && adsetInternalId) {
      for (const ad of data.data) {
        await supabase
          .from('meta_ads')
          .upsert({
            external_id: ad.id,
            adset_id: adsetInternalId,
            name: ad.name,
            status: ad.status,
            creative_id: ad.creative?.id,
            created_time: ad.created_time,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'external_id'
          })
      }
    }

    return NextResponse.json({
      success: true,
      ads: data.data || [],
      count: data.data?.length || 0
    })

  } catch (error) {
    console.error('Erro ao buscar anúncios:', error)
    return NextResponse.json({
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}
