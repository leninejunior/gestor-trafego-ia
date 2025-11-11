/**
 * Testar busca de páginas do Meta
 */

require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  console.log('🔍 Testando busca de páginas do Meta...\n')

  try {
    // Buscar uma conexão com token
    const { data: connections, error } = await supabase
      .from('client_meta_connections')
      .select('*')
      .eq('status', 'active')
      .limit(1)

    if (error || !connections || connections.length === 0) {
      console.log('❌ Nenhuma conexão encontrada')
      return
    }

    const conn = connections[0]
    console.log(`📱 Testando com conexão: ${conn.id}`)
    console.log(`   Token: ${conn.access_token ? 'Presente' : 'Ausente'}\n`)

    if (!conn.access_token) {
      console.log('❌ Token ausente')
      return
    }

    // Testar busca de contas de anúncios
    console.log('1️⃣ Buscando contas de anúncios...')
    const adAccountsUrl = `https://graph.facebook.com/v21.0/me/adaccounts?access_token=${conn.access_token}&fields=id,name&limit=5`
    
    const adAccountsResponse = await fetch(adAccountsUrl)
    const adAccountsData = await adAccountsResponse.json()
    
    if (adAccountsResponse.ok) {
      console.log(`✅ Contas de anúncios: ${adAccountsData.data?.length || 0}`)
      adAccountsData.data?.forEach(acc => {
        console.log(`   - ${acc.name} (${acc.id})`)
      })
    } else {
      console.log(`❌ Erro:`, adAccountsData.error?.message)
    }

    console.log()

    // Testar busca de páginas
    console.log('2️⃣ Buscando páginas do Facebook...')
    const pagesUrl = `https://graph.facebook.com/v21.0/me/accounts?access_token=${conn.access_token}&fields=id,name,category&limit=10`
    
    const pagesResponse = await fetch(pagesUrl)
    const pagesData = await pagesResponse.json()
    
    if (pagesResponse.ok) {
      console.log(`✅ Páginas: ${pagesData.data?.length || 0}`)
      if (pagesData.data && pagesData.data.length > 0) {
        pagesData.data.forEach(page => {
          console.log(`   - ${page.name} (${page.id})`)
          console.log(`     Categoria: ${page.category}`)
        })
      } else {
        console.log('   ⚠️  Nenhuma página encontrada')
        console.log('   Isso pode significar que:')
        console.log('   - O usuário não tem páginas do Facebook')
        console.log('   - As permissões não incluem acesso a páginas')
        console.log('   - O token não tem o scope "pages_show_list"')
      }
    } else {
      console.log(`❌ Erro:`, pagesData.error?.message)
      if (pagesData.error?.code === 190) {
        console.log('   Token inválido ou expirado!')
      }
    }

    console.log()

    // Verificar permissões do token
    console.log('3️⃣ Verificando permissões do token...')
    const permissionsUrl = `https://graph.facebook.com/v21.0/me/permissions?access_token=${conn.access_token}`
    
    const permissionsResponse = await fetch(permissionsUrl)
    const permissionsData = await permissionsResponse.json()
    
    if (permissionsResponse.ok) {
      console.log('✅ Permissões concedidas:')
      permissionsData.data?.forEach(perm => {
        if (perm.status === 'granted') {
          console.log(`   - ${perm.permission}`)
        }
      })
      
      const hasPages = permissionsData.data?.some(p => 
        p.permission === 'pages_show_list' && p.status === 'granted'
      )
      
      if (!hasPages) {
        console.log('\n⚠️  PROBLEMA: Permissão "pages_show_list" não concedida!')
        console.log('   Você precisa reconectar a conta e aceitar essa permissão')
      }
    }

  } catch (error) {
    console.error('❌ Erro:', error.message)
  }
}

main()
