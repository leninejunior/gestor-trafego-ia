#!/usr/bin/env node

/**
 * Script para buscar IDs dos planos no Supabase
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function getPlanIds() {
  console.log('🔍 Buscando planos no Supabase...\n');
  
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('id, name, monthly_price, annual_price, is_active')
    .eq('is_active', true)
    .order('monthly_price');

  if (error) {
    console.error('❌ Erro ao buscar planos:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log('⚠️  Nenhum plano encontrado no banco de dados');
    console.log('\n💡 Execute o schema primeiro:');
    console.log('   No Supabase SQL Editor, execute: database/subscription-plans-schema.sql');
    return;
  }

  console.log('📋 Planos disponíveis:\n');
  
  data.forEach(plan => {
    console.log(`${plan.name}:`);
    console.log(`  ID: ${plan.id}`);
    console.log(`  Mensal: R$ ${plan.monthly_price.toFixed(2)}`);
    console.log(`  Anual: R$ ${plan.annual_price.toFixed(2)}`);
    console.log('');
  });

  console.log('\n📝 Atualize os links na landing page:');
  console.log('\nsrc/components/landing/landing-page.tsx:\n');
  
  const basicPlan = data.find(p => p.name === 'Basic');
  const proPlan = data.find(p => p.name === 'Pro');
  const enterprisePlan = data.find(p => p.name === 'Enterprise');

  if (basicPlan) {
    console.log(`<Link href="/checkout?plan=${basicPlan.id}">Começar Agora</Link> // Basic`);
  }
  if (proPlan) {
    console.log(`<Link href="/checkout?plan=${proPlan.id}">Começar Agora</Link> // Pro`);
  }
  if (enterprisePlan) {
    console.log(`<Link href="/checkout?plan=${enterprisePlan.id}">Começar Agora</Link> // Enterprise`);
  }
}

getPlanIds().catch(console.error);
