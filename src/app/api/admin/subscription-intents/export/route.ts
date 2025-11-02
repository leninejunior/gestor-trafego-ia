/**
 * API para exportar dados de subscription intents
 * Suporta formatos CSV e JSON
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verificar se é admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verificar permissões de admin
    const { data: memberships } = await supabase
      .from('memberships')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!memberships || !['admin', 'super_admin'].includes(memberships.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { 
      format = 'csv', 
      period_start, 
      period_end,
      status_filter,
      plan_filter 
    } = body;

    // Construir query
    let query = supabase
      .from('subscription_intents')
      .select(`
        id,
        status,
        created_at,
        completed_at,
        user_email,
        user_name,
        organization_name,
        billing_cycle,
        cpf_cnpj,
        phone,
        iugu_customer_id,
        iugu_subscription_id,
        subscription_plans!inner(name, monthly_price, annual_price)
      `);

    // Aplicar filtros
    if (period_start) {
      query = query.gte('created_at', period_start);
    }
    if (period_end) {
      query = query.lte('created_at', period_end);
    }
    if (status_filter && status_filter !== 'all') {
      query = query.eq('status', status_filter);
    }
    if (plan_filter) {
      query = query.eq('plan_id', plan_filter);
    }

    const { data: exportData, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching export data:', error);
      return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }

    if (format === 'csv') {
      // Gerar CSV
      const csvHeaders = [
        'ID',
        'Status',
        'Email',
        'Nome',
        'Organização',
        'CPF/CNPJ',
        'Telefone',
        'Plano',
        'Ciclo de Cobrança',
        'Valor (R$)',
        'ID Cliente Iugu',
        'ID Assinatura Iugu',
        'Criado em',
        'Completado em'
      ].join(',') + '\n';

      const csvRows = exportData?.map(row => {
        const plan = row.subscription_plans as any;
        const price = row.billing_cycle === 'monthly' ? plan.monthly_price : plan.annual_price;
        
        return [
          `"${row.id}"`,
          `"${row.status}"`,
          `"${row.user_email}"`,
          `"${row.user_name}"`,
          `"${row.organization_name}"`,
          `"${row.cpf_cnpj || ''}"`,
          `"${row.phone || ''}"`,
          `"${plan.name}"`,
          `"${row.billing_cycle}"`,
          `"${price || 0}"`,
          `"${row.iugu_customer_id || ''}"`,
          `"${row.iugu_subscription_id || ''}"`,
          `"${new Date(row.created_at).toLocaleString('pt-BR')}"`,
          `"${row.completed_at ? new Date(row.completed_at).toLocaleString('pt-BR') : ''}"`
        ].join(',');
      }).join('\n') || '';

      const csvContent = csvHeaders + csvRows;
      const filename = `subscription-intents-${new Date().toISOString().split('T')[0]}.csv`;

      // Retornar CSV como download
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // Formato JSON
    const filename = `subscription-intents-${new Date().toISOString().split('T')[0]}.json`;
    
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error('Error exporting subscription intents:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}