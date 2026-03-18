#!/usr/bin/env node

/**
 * Diagnóstico detalhado do erro "Campanha não encontrada"
 * Simula exatamente o que a API faz para identificar onde falha
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente não configuradas');
  process.exit(1);
}

// Cliente com service role (sem RLS)
const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

// Cliente com anon key (com RLS - simula usuário autenticado)
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

async function diagnoseAdsetsError() {
  console.log('🔍 DIAGNÓSTICO: Erro "Campanha não encontrada"\n');

  try {
    // 1. Buscar uma campanha com service role
    console.log('1️⃣ Buscando campanha com SERVICE ROLE (sem RLS)...');
    const { data: campaigns, error: campaignsError } = await supabaseService
      .from('meta_campaigns')
      .select('id, external_id, name, connection_id')
      .limit(1);

    if (campaignsError || !campaigns || campaigns.length === 0) {
      console.error('❌ Erro ao buscar campanha:', campaignsError);
      return;
    }

    const campaign = campaigns[0];
    console.log('✅ Campanha encontrada:', {
      id: campaign.id,
      external_id: campaign.external_id,
      name: campaign.name,
      connection_id: campaign.connection_id
    });

    // 2. Buscar connection da campanha
    console.log('\n2️⃣ Buscando connection da campanha...');
    const { data: connection, error: connectionError } = await supabaseService
      .from('client_meta_connections')
      .select('id, client_id, ad_account_id, account_name')
      .eq('id', campaign.connection_id)
      .single();

    if (connectionError || !connection) {
      console.error('❌ Erro ao buscar connection:', connectionError);
    } else {
      console.log('✅ Connection encontrada:', {
        id: connection.id,
        client_id: connection.client_id,
        ad_account_id: connection.ad_account_id,
        account_name: connection.account_name
      });
    }

    // 3. Buscar client
    console.log('\n3️⃣ Buscando client...');
    const { data: client, error: clientError } = await supabaseService
      .from('clients')
      .select('id, name, org_id')
      .eq('id', connection.client_id)
      .single();

    if (clientError || !client) {
      console.error('❌ Erro ao buscar client:', clientError);
    } else {
      console.log('✅ Client encontrado:', {
        id: client.id,
        name: client.name,
        org_id: client.org_id
      });
    }

    // 4. Buscar memberships da organização
    console.log('\n4️⃣ Buscando memberships da organização...');
    const { data: memberships, error: membershipsError } = await supabaseService
      .from('memberships')
      .select('user_id, organization_id, role')
      .eq('organization_id', client.org_id);

    if (membershipsError) {
      console.error('❌ Erro ao buscar memberships:', membershipsError);
    } else {
      console.log(`✅ ${memberships?.length || 0} memberships encontrados`);
      if (memberships && memberships.length > 0) {
        console.log('   Primeiro usuário:', memberships[0].user_id);
      }
    }

    // 5. Simular busca com usuário autenticado (se houver memberships)
    if (memberships && memberships.length > 0) {
      const userId = memberships[0].user_id;
      console.log(`\n5️⃣ Simulando busca com usuário autenticado: ${userId}`);

      // Criar cliente com auth simulado
      const { data: authData, error: authError } = await supabaseService.auth.admin.getUserById(userId);
      
      if (authError) {
        console.error('❌ Erro ao buscar usuário:', authError);
      } else {
        console.log('✅ Usuário encontrado:', authData.user.email);

        // Tentar buscar campanha com RLS (usando anon key + auth)
        console.log('\n6️⃣ Tentando buscar campanha COM RLS (anon key)...');
        
        // Nota: Não podemos simular auth.uid() aqui, mas podemos verificar as políticas
        const { data: campaignWithRLS, error: campaignRLSError } = await supabaseAnon
          .from('meta_campaigns')
          .select('id, external_id, name')
          .eq('id', campaign.id)
          .single();

        if (campaignRLSError) {
          console.error('❌ Erro ao buscar campanha com RLS:', campaignRLSError);
          console.log('\n⚠️ PROBLEMA IDENTIFICADO: RLS está bloqueando acesso!');
          console.log('   Possíveis causas:');
          console.log('   1. Política RLS de meta_campaigns não permite SELECT sem auth');
          console.log('   2. Política RLS requer join com memberships');
          console.log('   3. Usuário não tem permissão para este client');
        } else {
          console.log('✅ Campanha acessível com RLS:', campaignWithRLS.id);
        }
      }
    }

    // 7. Verificar políticas RLS
    console.log('\n7️⃣ Verificando políticas RLS de meta_campaigns...');
    const { data: policies, error: policiesError } = await supabaseService
      .from('pg_policies')
      .select('policyname, cmd, qual, with_check')
      .eq('tablename', 'meta_campaigns');

    if (policiesError) {
      console.error('❌ Erro ao buscar políticas:', policiesError);
    } else {
      console.log(`✅ ${policies?.length || 0} políticas encontradas`);
      policies?.forEach(policy => {
        console.log(`   - ${policy.policyname} (${policy.cmd})`);
      });
    }

    // 8. Buscar adsets da campanha com service role
    console.log('\n8️⃣ Buscando adsets da campanha com SERVICE ROLE...');
    const { data: adsets, error: adsetsError } = await supabaseService
      .from('meta_adsets')
      .select('id, external_id, name, campaign_id')
      .eq('campaign_id', campaign.id);

    if (adsetsError) {
      console.error('❌ Erro ao buscar adsets:', adsetsError);
    } else {
      console.log(`✅ ${adsets?.length || 0} adsets encontrados`);
      if (adsets && adsets.length > 0) {
        console.log('   Exemplo:', {
          id: adsets[0].id,
          name: adsets[0].name,
          campaign_id: adsets[0].campaign_id
        });
      }
    }

    // Resumo
    console.log('\n📊 RESUMO DO DIAGNÓSTICO:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Campanha existe: ${campaign.id}`);
    console.log(`✅ Connection existe: ${connection?.id || 'N/A'}`);
    console.log(`✅ Client existe: ${client?.id || 'N/A'}`);
    console.log(`✅ Memberships: ${memberships?.length || 0}`);
    console.log(`✅ Adsets: ${adsets?.length || 0}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n💡 PRÓXIMOS PASSOS:');
    console.log('1. Verificar se RLS está bloqueando acesso (erro acima)');
    console.log('2. Verificar se usuário tem membership na organização');
    console.log('3. Verificar políticas RLS de meta_campaigns');
    console.log('4. Testar com usuário real no navegador (F12 > Console)');

  } catch (error) {
    console.error('💥 Erro inesperado:', error);
  }
}

diagnoseAdsetsError();
