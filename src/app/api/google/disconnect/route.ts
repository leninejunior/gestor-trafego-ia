/**
 * Google Ads Disconnect API Route
 *
 * Revokes Google Ads connection and cleans up data
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getGoogleTokenManager } from '@/lib/google/token-manager';
import {
  deleteGoogleConnectionById,
  deleteGoogleConnectionRelatedData,
  getClientOrganizationId,
  getGoogleConnectionByClientAndCustomer,
  getGoogleConnectionById,
  getGoogleConnectionDataCounts,
  hasOrgAdminAccess,
  hasOrgMembershipAccess,
  isUserSuperAdmin,
  listGoogleConnectionsByClient,
  markGoogleConnectionRevoked,
} from '@/lib/postgres/google-sync-repository';
import { z } from 'zod';

const DisconnectRequestSchema = z.object({
  connectionId: z.string().uuid('Connection ID deve ser um UUID válido').optional(),
  clientId: z.string().uuid('Client ID deve ser um UUID válido').optional(),
  customerId: z.string().optional(),
  revokeTokens: z.boolean().default(true),
  deleteData: z.boolean().default(false),
}).refine(
  (data) => data.connectionId || (data.clientId && data.customerId),
  {
    message: 'Deve fornecer connectionId ou (clientId + customerId)',
  }
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectionId, clientId, customerId, revokeTokens, deleteData } =
      DisconnectRequestSchema.parse(body);

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const connection = connectionId
      ? await getGoogleConnectionById(connectionId)
      : await getGoogleConnectionByClientAndCustomer(clientId!, customerId!);

    if (!connection || !connection.client_id) {
      return NextResponse.json(
        { error: 'Conexão não encontrada' },
        { status: 404 }
      );
    }

    const clientOrgId = await getClientOrganizationId(connection.client_id);

    if (!clientOrgId) {
      return NextResponse.json(
        { error: 'Cliente não encontrado ou sem organização vinculada' },
        { status: 404 }
      );
    }

    const superAdmin = await isUserSuperAdmin(user.id);
    const hasWriteAccess = superAdmin || await hasOrgAdminAccess(user.id, clientOrgId);

    if (!hasWriteAccess) {
      return NextResponse.json(
        { error: 'Acesso negado à conexão especificada' },
        { status: 403 }
      );
    }

    if (revokeTokens && connection.status !== 'revoked') {
      try {
        const tokenManager = getGoogleTokenManager();
        await tokenManager.revokeTokens(connection.id);
        console.log('[Google Disconnect] Tokens revoked for connection:', connection.id);
      } catch (revokeError) {
        console.error('[Google Disconnect] Error revoking tokens:', revokeError);
      }
    }

    if (deleteData) {
      await deleteGoogleConnectionRelatedData(connection.id);

      const deleted = await deleteGoogleConnectionById(connection.id);
      if (!deleted) {
        return NextResponse.json(
          { error: 'Erro ao deletar conexão' },
          { status: 500 }
        );
      }

      console.log('[Google Disconnect] Connection deleted:', connection.id);
    } else {
      const revoked = await markGoogleConnectionRevoked(connection.id);

      if (!revoked) {
        return NextResponse.json(
          { error: 'Erro ao atualizar status da conexão' },
          { status: 500 }
        );
      }

      console.log('[Google Disconnect] Connection marked as revoked:', connection.id);
    }

    return NextResponse.json({
      success: true,
      connectionId: connection.id,
      clientId: connection.client_id,
      customerId: connection.customer_id,
      action: deleteData ? 'deleted' : 'revoked',
      tokensRevoked: revokeTokens,
      dataDeleted: deleteData,
      message: deleteData
        ? 'Conexão e dados deletados com sucesso'
        : 'Conexão desconectada com sucesso',
    });
  } catch (error) {
    console.error('[Google Disconnect] Error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Dados inválidos',
          details: error.issues.map((e) => e.message),
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get('connectionId');
    const clientId = searchParams.get('clientId');

    if (!connectionId && !clientId) {
      return NextResponse.json(
        { error: 'Connection ID ou Client ID é obrigatório' },
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

    const connections = connectionId
      ? [await getGoogleConnectionById(connectionId)].filter(Boolean)
      : await listGoogleConnectionsByClient(clientId!);

    if (!connections || connections.length === 0) {
      return NextResponse.json(
        { error: 'Conexão não encontrada' },
        { status: 404 }
      );
    }

    const superAdmin = await isUserSuperAdmin(user.id);

    const accessibleConnections = (
      await Promise.all(
        connections.map(async (connection) => {
          if (!connection?.client_id) {
            return null;
          }

          const orgId = await getClientOrganizationId(connection.client_id);
          if (!orgId) {
            return null;
          }

          const hasAccess = superAdmin || await hasOrgMembershipAccess(user.id, orgId);
          if (!hasAccess) {
            return null;
          }

          const counts = await getGoogleConnectionDataCounts(connection.id);

          return {
            ...connection,
            ...counts,
          };
        })
      )
    ).filter(Boolean);

    if (accessibleConnections.length === 0) {
      return NextResponse.json(
        { error: 'Acesso negado às conexões especificadas' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      connections: accessibleConnections,
      disconnectionOptions: {
        revokeTokens: {
          description: 'Revogar tokens de acesso no Google',
          recommended: true,
          reversible: false,
        },
        deleteData: {
          description: 'Deletar todos os dados de campanhas e métricas',
          recommended: false,
          reversible: false,
          warning: 'Esta ação não pode ser desfeita',
        },
      },
    });
  } catch (error) {
    console.error('[Google Disconnect GET] Error:', error);

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
