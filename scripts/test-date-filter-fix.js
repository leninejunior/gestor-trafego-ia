require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDateFilterFix() {
  console.log('🧪 Testando correção do filtro de data...\n');

  const adsetId = 'c53c9140-0d48-4209-8c4d-47347c0cf35c';

  // Calcular período "Últimos 30 dias"
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 29); // Últimos 30 dias = hoje - 29 dias

  const since = thirtyDaysAgo.toISOString().split('T')[0];
  const until = today.toISOString().split('T')[0];

  console.log('📅 Período "Últimos 30 dias":');
  console.log('   Since:', since);
  console.log('   Until:', until);
  console.log('');

  // Buscar insights no banco
  const { data: allInsights } = await supabase
    .from('meta_adset_insights')
    .select('*')
    .eq('adset_id', adsetId);

  console.log(`📊 Total de insights no banco: ${allInsights?.length || 0}`);
  if (allInsights && allInsights.length > 0) {
    allInsights.forEach((insight, index) => {
      console.log(`   ${index + 1}. Período: ${insight.date_start} a ${insight.date_stop}`);
    });
  }
  console.log('');

  // Teste 1: Filtro ANTIGO (errado)
  console.log('❌ Teste 1: Filtro ANTIGO (errado)');
  console.log('   Lógica: date_start >= since AND date_stop <= until');
  const { data: oldFilterResults } = await supabase
    .from('meta_adset_insights')
    .select('*')
    .eq('adset_id', adsetId)
    .gte('date_start', since)
    .lte('date_stop', until);

  console.log(`   Resultados: ${oldFilterResults?.length || 0} insights`);
  if (oldFilterResults && oldFilterResults.length > 0) {
    oldFilterResults.forEach((insight) => {
      console.log(`   - ${insight.date_start} a ${insight.date_stop}: Gasto=${insight.spend}`);
    });
  } else {
    console.log('   ⚠️ Nenhum insight retornado (PROBLEMA!)');
  }
  console.log('');

  // Teste 2: Filtro NOVO (correto)
  console.log('✅ Teste 2: Filtro NOVO (correto)');
  console.log('   Lógica: date_start <= until AND date_stop >= since');
  const { data: newFilterResults } = await supabase
    .from('meta_adset_insights')
    .select('*')
    .eq('adset_id', adsetId)
    .lte('date_start', until)
    .gte('date_stop', since);

  console.log(`   Resultados: ${newFilterResults?.length || 0} insights`);
  if (newFilterResults && newFilterResults.length > 0) {
    newFilterResults.forEach((insight) => {
      console.log(`   - ${insight.date_start} a ${insight.date_stop}: Gasto=${insight.spend}`);
    });
  } else {
    console.log('   ⚠️ Nenhum insight retornado');
  }
  console.log('');

  // Análise
  console.log('📊 Análise:');
  console.log('');

  if (allInsights && allInsights.length > 0) {
    const insight = allInsights[0];
    const dateStart = new Date(insight.date_start);
    const dateStop = new Date(insight.date_stop);
    const sinceDate = new Date(since);
    const untilDate = new Date(until);

    console.log('   Insight no banco:');
    console.log(`   - date_start: ${insight.date_start}`);
    console.log(`   - date_stop: ${insight.date_stop}`);
    console.log('');

    console.log('   Período solicitado:');
    console.log(`   - since: ${since}`);
    console.log(`   - until: ${until}`);
    console.log('');

    console.log('   Filtro ANTIGO (errado):');
    console.log(`   - date_start >= since? ${dateStart >= sinceDate ? '✅' : '❌'} (${insight.date_start} >= ${since})`);
    console.log(`   - date_stop <= until? ${dateStop <= untilDate ? '✅' : '❌'} (${insight.date_stop} <= ${until})`);
    console.log(`   - Resultado: ${(dateStart >= sinceDate && dateStop <= untilDate) ? '✅ Incluído' : '❌ Excluído'}`);
    console.log('');

    console.log('   Filtro NOVO (correto):');
    console.log(`   - date_start <= until? ${dateStart <= untilDate ? '✅' : '❌'} (${insight.date_start} <= ${until})`);
    console.log(`   - date_stop >= since? ${dateStop >= sinceDate ? '✅' : '❌'} (${insight.date_stop} >= ${since})`);
    console.log(`   - Resultado: ${(dateStart <= untilDate && dateStop >= sinceDate) ? '✅ Incluído' : '❌ Excluído'}`);
    console.log('');
  }

  // Conclusão
  console.log('🎯 Conclusão:');
  console.log('');
  
  if ((oldFilterResults?.length || 0) === 0 && (newFilterResults?.length || 0) > 0) {
    console.log('✅ CORREÇÃO VALIDADA!');
    console.log('   - Filtro antigo: 0 resultados (problema)');
    console.log('   - Filtro novo: ' + newFilterResults.length + ' resultados (correto)');
    console.log('');
    console.log('   A correção está funcionando corretamente!');
  } else if ((oldFilterResults?.length || 0) > 0 && (newFilterResults?.length || 0) > 0) {
    console.log('⚠️ Ambos os filtros retornam resultados');
    console.log('   Isso pode acontecer se os insights estão completamente dentro do período.');
    console.log('   A correção ainda é válida para casos onde insights começam antes do período.');
  } else if ((oldFilterResults?.length || 0) === 0 && (newFilterResults?.length || 0) === 0) {
    console.log('⚠️ Nenhum filtro retorna resultados');
    console.log('   Verifique se há insights no banco para este adset.');
  } else {
    console.log('❌ Resultado inesperado');
    console.log('   Filtro antigo: ' + (oldFilterResults?.length || 0));
    console.log('   Filtro novo: ' + (newFilterResults?.length || 0));
  }

  console.log('');
  console.log('✅ Teste concluído!');
}

testDateFilterFix();
