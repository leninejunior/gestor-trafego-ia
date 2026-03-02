/**
 * API para executar ações manuais de troubleshooting
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { type, intentId, reason, notes } = await request.json();

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

    // Validar parâmetros
    if (!type || !intentId || !reason) {
      return NextResponse.json({ 
        error: 'Parâmetros obrigatórios: type, intentId, reason' 
      }, { status: 400 });
    }

    let result = {};

    switch (type) {
      case 'force_activate':
        result = await forceActivateIntent(supabase, intentId, user.id, reason, notes);
        break;
      
      case 'force_cancel':
        result = await forceCancelIntent(supabase, intentId, user.id, reason, notes);
        break;
      
      case 'reset_status':
        result = await resetIntentStatus(supabase, intentId, user.id, reason, notes);
        break;
      
      case 'regenerate_urls':
        result = await regenerateIntentUrls(supabase, intentId, user.id, reason, notes);
        break;
      
      case 'resend_notifications':
        return NextResponse.json(
          {
            success: false,
            error: 'Reenvio manual de notificações indisponível sem integração real de notificações.',
            code: 'FEATURE_UNAVAILABLE'
          },
          { status: 501 }
        );
      
      default:
        return NextResponse.json({ error: 'Tipo de ação inválido' }, { status: 400 });
    }

    // Registrar ação no log de auditoria
    await logManualAction(supabase, {
      action_type: type,
      intent_id: intentId,
      admin_user_id: user.id,
      reason,
      notes,
      result
    });

    return NextResponse.json({
      success: true,
      message: `Ação ${type} executada com sucesso`,
      result
    });

  } catch (error) {
    console.error('Error executing manual action:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

async function forceActivateIntent(supabase: any, intentId: string, adminUserId: string, reason: string, notes?: string) {
  // Buscar o intent
  const { data: intent, error: fetchError } = await supabase
    .from('subscription_intents')
    .select('*')
    .eq('id', intentId)
    .single();

  if (fetchError || !intent) {
    throw new Error('Intent não encontrado');
  }

  if (intent.status === 'completed') {
    throw new Error('Intent já está ativo');
  }

  // Atualizar status para completed
  const { error: updateError } = await supabase
    .from('subscription_intents')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', intentId);

  if (updateError) {
    throw new Error(`Erro ao atualizar intent: ${updateError.message}`);
  }

  // Criar usuário se não existir
  let userId = intent.user_id;
  if (!userId) {
    // Verificar se usuário já existe pelo email
    const { data: existingUser } = await supabase.auth.admin.listUsers();
    const userExists = existingUser.users.find(u => u.email === intent.user_email);

    if (!userExists) {
      // Criar usuário
      const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
        email: intent.user_email,
        email_confirm: true,
        user_metadata: {
          name: intent.user_name,
          created_by_admin: true,
          activation_reason: reason
        }
      });

      if (createUserError) {
        throw new Error(`Erro ao criar usuário: ${createUserError.message}`);
      }

      userId = newUser.user.id;

      // Atualizar intent com user_id
      await supabase
        .from('subscription_intents')
        .update({ user_id: userId })
        .eq('id', intentId);
    } else {
      userId = userExists.id;
    }
  }

  // Criar organização se não existir
  const { data: existingOrg } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_id', userId)
    .single();

  if (!existingOrg) {
    const { data: newOrg, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: intent.organization_name,
        owner_id: userId,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (orgError) {
      throw new Error(`Erro ao criar organização: ${orgError.message}`);
    }

    // Criar membership
    await supabase
      .from('organization_memberships')
      .insert({
        organization_id: newOrg.id,
        user_id: userId,
        role: 'owner',
        created_at: new Date().toISOString()
      });
  }

  // Criar assinatura ativa
  const { data: plan } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('id', intent.plan_id)
    .single();

  if (plan) {
    const startDate = new Date();
    const endDate = new Date();
    
    if (intent.billing_cycle === 'annual') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    await supabase
      .from('subscriptions')
      .insert({
        user_id: userId,
        plan_id: intent.plan_id,
        status: 'active',
        billing_cycle: intent.billing_cycle,
        current_period_start: startDate.toISOString(),
        current_period_end: endDate.toISOString(),
        created_at: new Date().toISOString(),
        metadata: {
          activated_manually: true,
          admin_user_id: adminUserId,
          reason: reason,
          original_intent_id: intentId
        }
      });
  }

  return {
    intent_id: intentId,
    user_id: userId,
    status: 'activated',
    timestamp: new Date().toISOString()
  };
}

async function forceCancelIntent(supabase: any, intentId: string, adminUserId: string, reason: string, notes?: string) {
  const { error } = await supabase
    .from('subscription_intents')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
      metadata: {
        cancelled_manually: true,
        admin_user_id: adminUserId,
        reason: reason,
        notes: notes
      }
    })
    .eq('id', intentId);

  if (error) {
    throw new Error(`Erro ao cancelar intent: ${error.message}`);
  }

  return {
    intent_id: intentId,
    status: 'cancelled',
    timestamp: new Date().toISOString()
  };
}

async function resetIntentStatus(supabase: any, intentId: string, adminUserId: string, reason: string, notes?: string) {
  const { error } = await supabase
    .from('subscription_intents')
    .update({
      status: 'pending',
      completed_at: null,
      updated_at: new Date().toISOString(),
      metadata: {
        reset_manually: true,
        admin_user_id: adminUserId,
        reason: reason,
        notes: notes
      }
    })
    .eq('id', intentId);

  if (error) {
    throw new Error(`Erro ao resetar status: ${error.message}`);
  }

  return {
    intent_id: intentId,
    status: 'reset_to_pending',
    timestamp: new Date().toISOString()
  };
}

async function regenerateIntentUrls(supabase: any, intentId: string, adminUserId: string, reason: string, notes?: string) {
  // Gerar novas URLs
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const newCheckoutUrl = `${baseUrl}/checkout/${intentId}`;
  const newStatusUrl = `${baseUrl}/checkout/status/${intentId}`;

  const { error } = await supabase
    .from('subscription_intents')
    .update({
      checkout_url: newCheckoutUrl,
      updated_at: new Date().toISOString(),
      metadata: {
        urls_regenerated: true,
        admin_user_id: adminUserId,
        reason: reason,
        notes: notes
      }
    })
    .eq('id', intentId);

  if (error) {
    throw new Error(`Erro ao regenerar URLs: ${error.message}`);
  }

  return {
    intent_id: intentId,
    checkout_url: newCheckoutUrl,
    status_url: newStatusUrl,
    timestamp: new Date().toISOString()
  };
}

async function logManualAction(supabase: any, actionData: any) {
  try {
    await supabase
      .from('admin_action_logs')
      .insert({
        ...actionData,
        created_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Error logging manual action:', error);
    // Não falhar a operação principal por causa do log
  }
}
