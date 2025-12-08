/**
 * API para gerenciar subscription intent específico
 * Permite visualizar detalhes e executar ações administrativas
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSubscriptionIntentService } from '@/lib/services/subscription-intent-service';

interface RouteParams {
  params: {
    intentId: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    
    // Verificar se é admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verificar permissões de admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Buscar subscription intent com detalhes
    const { data: intent, error } = await supabase
      .from('subscription_intents')
      .select(`
        *,
        plan:subscription_plans(
          id,
          name,
          description,
          monthly_price,
          annual_price,
          features
        ),
        user:auth.users(
          id,
          email,
          created_at,
          last_sign_in_at
        )
      `)
      .eq('id', params.intentId)
      .single();

    if (error || !intent) {
      return NextResponse.json(
        { error: 'Subscription intent not found' },
        { status: 404 }
      );
    }

    // Buscar logs de webhook relacionados
    const { data: webhookLogs } = await supabase
      .from('webhook_logs')
      .select('*')
      .eq('subscription_intent_id', params.intentId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Buscar transições de estado
    const { data: stateTransitions } = await supabase
      .from('subscription_intent_transitions')
      .select('*')
      .eq('subscription_intent_id', params.intentId)
      .order('created_at', { ascending: false });

    return NextResponse.json({
      intent,
      webhook_logs: webhookLogs || [],
      state_transitions: stateTransitions || []
    });

  } catch (error) {
    console.error('Error fetching subscription intent details:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    
    // Verificar se é admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verificar permissões de admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { action, ...updateData } = body;

    const intentService = getSubscriptionIntentService();

    switch (action) {
      case 'activate':
        // Ativar manualmente uma assinatura (transição para completed)
        const activatedIntent = await intentService.executeStateTransition(
          params.intentId,
          'completed',
          {
            reason: 'Manual activation by admin',
            triggeredBy: user.id,
            metadata: { admin_action: true }
          }
        );
        return NextResponse.json({ 
          success: true, 
          intent: activatedIntent,
          message: 'Subscription activated successfully'
        });

      case 'cancel':
        // Cancelar uma intenção (transição para expired)
        const cancelledIntent = await intentService.deleteIntent(params.intentId);
        return NextResponse.json({ 
          success: true, 
          deleted: cancelledIntent,
          message: 'Subscription intent cancelled'
        });

      case 'update_status':
        // Atualizar status manualmente
        if (!updateData.status) {
          return NextResponse.json(
            { error: 'Status is required' },
            { status: 400 }
          );
        }
        
        const updatedIntent = await intentService.updateIntent(
          params.intentId, 
          { status: updateData.status },
          {
            reason: updateData.reason || 'Admin status update',
            triggeredBy: user.id
          }
        );
        
        return NextResponse.json({ 
          success: true, 
          intent: updatedIntent,
          message: 'Status updated successfully'
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Valid actions: activate, cancel, update_status' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error updating subscription intent:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    
    // Verificar se é admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verificar permissões de super admin para deletar
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Deletar subscription intent (apenas super admin)
    const { error } = await supabase
      .from('subscription_intents')
      .delete()
      .eq('id', params.intentId);

    if (error) {
      console.error('Error deleting subscription intent:', error);
      return NextResponse.json(
        { error: 'Failed to delete subscription intent' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: 'Subscription intent deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting subscription intent:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}