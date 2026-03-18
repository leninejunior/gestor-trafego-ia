import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasOrganizationAccess } from '@/lib/postgres/meta-connections-repository';
import {
  deleteLeadById,
  getLeadByIdWithDetails,
  getLeadContextById,
  updateLeadById,
} from '@/lib/postgres/meta-leads-repository';

async function ensureLeadAccess(leadId: string, userId: string): Promise<boolean> {
  const context = await getLeadContextById(leadId);
  if (!context) {
    return false;
  }

  return hasOrganizationAccess(userId, context.org_id);
}

// GET - Buscar detalhes de um lead
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const hasAccess = await ensureLeadAccess(leadId, user.id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 });
    }

    const lead = await getLeadByIdWithDetails(leadId);
    if (!lead) {
      return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ lead });

  } catch (error: unknown) {
    console.error('Erro ao buscar lead:', error);
    return NextResponse.json({
      error: 'Erro ao buscar lead',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

// PATCH - Atualizar lead (status, notas, atribuição)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const hasAccess = await ensureLeadAccess(leadId, user.id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 });
    }

    const body = await request.json() as {
      status?: string;
      notes?: string | null;
      assigned_to?: string | null;
    };

    const lead = await updateLeadById(leadId, {
      status: body.status,
      notes: body.notes,
      assigned_to: body.assigned_to,
    });

    if (!lead) {
      return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ lead });

  } catch (error: unknown) {
    console.error('Erro ao atualizar lead:', error);
    return NextResponse.json({
      error: 'Erro ao atualizar lead',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

// DELETE - Deletar lead
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const hasAccess = await ensureLeadAccess(leadId, user.id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 });
    }

    await deleteLeadById(leadId);
    return NextResponse.json({ success: true });

  } catch (error: unknown) {
    console.error('Erro ao deletar lead:', error);
    return NextResponse.json({
      error: 'Erro ao deletar lead',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
