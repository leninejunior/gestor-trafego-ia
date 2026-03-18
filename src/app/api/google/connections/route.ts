/**
 * API Route: Gerenciar Conexões Google Ads
 * Requirements: 6.2, 6.4 - Bloquear criação por usuários comuns, 5.1, 5.2 - Filtrar por acesso
 * 
 * GET - Listar todas as conexões de um cliente
 * DELETE - Excluir uma conexão específica
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  deleteGoogleConnectionById,
  getClientOrganizationId,
  getGoogleConnectionById,
  hasOrgAdminAccess,
  hasOrgMembershipAccess,
  isUserSuperAdmin,
  listGoogleConnectionsByClient,
} from '@/lib/postgres/google-sync-repository';

export async function GET(request: NextRequest) {
  try {
    const clientId = request.nextUrl.searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json(
        { error: 'clientId é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const clientOrgId = await getClientOrganizationId(clientId);
    if (!clientOrgId) {
      return NextResponse.json(
        { error: 'Cliente não encontrado' },
        { status: 404 }
      );
    }

    const superAdmin = await isUserSuperAdmin(user.id);
    const hasAccess = superAdmin || await hasOrgMembershipAccess(user.id, clientOrgId);

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Acesso negado para visualizar conexões deste cliente' },
        { status: 403 }
      );
    }

    const connections = await listGoogleConnectionsByClient(clientId);

    return NextResponse.json({
      connections,
      total: connections.length,
    });
  } catch (error) {
    console.error('[Google Connections API] Erro:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const connectionId = request.nextUrl.searchParams.get('connectionId');

    if (!connectionId) {
      return NextResponse.json(
        { error: 'connectionId é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const connection = await getGoogleConnectionById(connectionId);
    if (!connection || !connection.client_id) {
      return NextResponse.json(
        { error: 'Conexão não encontrada' },
        { status: 404 }
      );
    }

    const clientOrgId = await getClientOrganizationId(connection.client_id);
    if (!clientOrgId) {
      return NextResponse.json(
        { error: 'Cliente não encontrado' },
        { status: 404 }
      );
    }

    const superAdmin = await isUserSuperAdmin(user.id);
    const hasDeleteAccess = superAdmin || await hasOrgAdminAccess(user.id, clientOrgId);

    if (!hasDeleteAccess) {
      return NextResponse.json(
        {
          error: 'Acesso negado: você não tem permissão para excluir conexões deste cliente',
          code: 'CLIENT_ACCESS_DENIED'
        },
        { status: 403 }
      );
    }

    const deleted = await deleteGoogleConnectionById(connectionId);
    if (!deleted) {
      return NextResponse.json(
        { error: 'Conexão não encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Conexão excluída com sucesso',
    });
  } catch (error) {
    console.error('[Google Connections API] Erro:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
