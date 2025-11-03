import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkAdminAuth, createAdminAuthErrorResponse } from '@/lib/middleware/admin-auth-improved';
import { z } from 'zod';

const manualAdjustmentSchema = z.object({
  organizationId: z.string().uuid(),
  adjustmentType: z.enum(['plan_change', 'manual_approval', 'billing_adjustment', 'status_change']),
  newPlanId: z.string().uuid().optional(),
  reason: z.string().min(1),
  notes: z.string().optional(),
  effectiveDate: z.string().optional(),
  amount: z.number().optional(),
  billingCycle: z.enum(['monthly', 'annual']).optional()
});

/**
 * POST /api/admin/subscriptions/manual-adjustment
 * Permite ajustes manuais de planos e assinaturas por administradores
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação de admin
    const authResult = await checkAdminAuth();
    if (!authResult.success) {
      return createAdminAuthErrorResponse(authResult);
    }
    const user = authResult.user;

    const body = await request.json();
    const validatedData = manualAdjustmentSchema.parse(body);

    const supabase = await createClient();

    // Buscar organização
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', validatedData.organizationId)
      .single();

    if (orgError || !organization) {
      return NextResponse.json(
        { success: false, error: 'Organização não encontrada' },
        { status: 404 }
      );
    }

    // Buscar assinatura ativa da organização
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select(`
        id,
        plan_id,
        status,
        billing_cycle,
        current_period_start,
        current_period_end,
        subscription_plans!inner (
          id,
          name,
          monthly_price,
          annual_price
        )
      `)
      .eq('organization_id', validatedData.organizationId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (subError || !subscription) {
      return NextResponse.json(
        { success: false, error: 'Assinatura ativa não encontrada para esta organização' },
        { status: 404 }
      );
    }

    const currentSubscription = subscription;

    let adjustmentResult: any = {};

    switch (validatedData.adjustmentType) {
      case 'plan_change':
        if (!validatedData.newPlanId) {
          return NextResponse.json(
            { success: false, error: 'ID do novo plano é obrigatório para mudança de plano' },
            { status: 400 }
          );
        }

        // Buscar novo plano
        const { data: newPlan, error: planError } = await supabase
          .from('subscription_plans')
          .select('*')
          .eq('id', validatedData.newPlanId)
          .single();

        if (planError || !newPlan) {
          return NextResponse.json(
            { success: false, error: 'Novo plano não encontrado' },
            { status: 404 }
          );
        }

        // Atualizar assinatura
        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({
            plan_id: validatedData.newPlanId,
            billing_cycle: validatedData.billingCycle || currentSubscription.billing_cycle,
            updated_at: new Date().toISOString()
          })
          .eq('id', currentSubscription.id);

        if (updateError) {
          throw updateError;
        }

        adjustmentResult = {
          type: 'plan_change',
          oldPlan: currentSubscription.subscription_plans.name,
          newPlan: newPlan.name,
          oldPrice: currentSubscription.billing_cycle === 'monthly' 
            ? currentSubscription.subscription_plans.monthly_price 
            : currentSubscription.subscription_plans.annual_price,
          newPrice: validatedData.billingCycle === 'monthly' || (!validatedData.billingCycle && currentSubscription.billing_cycle === 'monthly')
            ? newPlan.monthly_price 
            : newPlan.annual_price
        };
        break;

      case 'manual_approval':
        // Aprovar manualmente uma assinatura pendente
        const { error: approvalError } = await supabase
          .from('subscriptions')
          .update({
            status: 'active',
            updated_at: new Date().toISOString()
          })
          .eq('id', currentSubscription.id);

        if (approvalError) {
          throw approvalError;
        }

        adjustmentResult = {
          type: 'manual_approval',
          previousStatus: currentSubscription.status,
          newStatus: 'active'
        };
        break;

      case 'billing_adjustment':
        if (!validatedData.amount) {
          return NextResponse.json(
            { success: false, error: 'Valor é obrigatório para ajuste de cobrança' },
            { status: 400 }
          );
        }

        // Criar fatura de ajuste
        const { error: invoiceError } = await supabase
          .from('subscription_invoices')
          .insert({
            subscription_id: currentSubscription.id,
            invoice_number: `ADJ-${Date.now()}`,
            amount: validatedData.amount,
            currency: 'BRL',
            status: 'paid',
            line_items: [{
              description: `Ajuste manual: ${validatedData.reason}`,
              amount: validatedData.amount,
              type: 'adjustment'
            }],
            due_date: new Date().toISOString(),
            paid_at: new Date().toISOString(),
            notes: validatedData.notes
          });

        if (invoiceError) {
          throw invoiceError;
        }

        adjustmentResult = {
          type: 'billing_adjustment',
          amount: validatedData.amount,
          description: validatedData.reason
        };
        break;

      case 'status_change':
        // Mudança manual de status
        const newStatus = validatedData.notes || 'active'; // Status deve vir nas notes para este tipo
        
        const { error: statusError } = await supabase
          .from('subscriptions')
          .update({
            status: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', currentSubscription.id);

        if (statusError) {
          throw statusError;
        }

        adjustmentResult = {
          type: 'status_change',
          previousStatus: currentSubscription.status,
          newStatus: newStatus
        };
        break;
    }

    // Tentar registrar no histórico de auditoria (se a tabela existir)
    try {
      const { error: auditError } = await supabase
        .from('subscription_audit_log')
        .insert({
          subscription_id: currentSubscription.id,
          organization_id: validatedData.organizationId,
          admin_user_id: user.id,
          action_type: validatedData.adjustmentType,
          reason: validatedData.reason,
          notes: validatedData.notes,
          previous_data: {
            plan_id: currentSubscription.plan_id,
            status: currentSubscription.status,
            billing_cycle: currentSubscription.billing_cycle
          },
          new_data: adjustmentResult,
          effective_date: validatedData.effectiveDate || new Date().toISOString(),
          created_at: new Date().toISOString()
        });

      if (auditError) {
        console.log('Aviso: Não foi possível registrar auditoria (tabela pode não existir):', auditError.message);
      }
    } catch (auditError) {
      console.log('Aviso: Tabela de auditoria não encontrada. Ajuste aplicado sem log de auditoria.');
    }

    return NextResponse.json({
      success: true,
      message: 'Ajuste manual aplicado com sucesso',
      adjustment: adjustmentResult,
      organization: organization.name
    });

  } catch (error) {
    console.error('Erro no ajuste manual:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Falha ao aplicar ajuste manual' },
      { status: 500 }
    );
  }
}