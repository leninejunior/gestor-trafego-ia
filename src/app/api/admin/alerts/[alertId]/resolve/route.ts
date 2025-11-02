/**
 * API para resolver alertas críticos
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteParams {
  params: {
    alertId: string;
  };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = createClient();
    const { alertId } = params;

    // Verificar autenticação e permissões de admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Verificar se é admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Em um sistema real, aqui atualizaríamos o alerta no banco de dados
    // Por enquanto, apenas simulamos a resolução
    
    // Log da ação administrativa
    await supabase
      .from('admin_action_logs')
      .insert({
        action_type: 'resolve_alert',
        admin_user_id: user.id,
        reason: 'Alert manually resolved by admin',
        result: {
          alert_id: alertId,
          resolved_at: new Date().toISOString()
        },
        created_at: new Date().toISOString()
      });

    return NextResponse.json({
      success: true,
      message: 'Alerta resolvido com sucesso',
      alert_id: alertId,
      resolved_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error resolving alert:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}