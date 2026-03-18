/**
 * Google Ads Accounts API - Refatorado
 * 
 * Lista contas Google Ads disponíveis para uma conexão
 * Usa GoogleOAuthFlowManager para lógica centralizada
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGoogleOAuthFlowManager } from '@/lib/google/oauth-flow-manager';

export async function GET(request: NextRequest) {
  console.log('[Google Accounts API] 🔍 Buscando contas Google Ads');
  
  try {
    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get('connectionId');
    const clientId = searchParams.get('clientId');
    
    // Validar parâmetros
    if (!connectionId || !clientId) {
      return NextResponse.json(
        { error: 'Parâmetros connectionId e clientId são obrigatórios' },
        { status: 400 }
      );
    }
    
    // Listar contas usando flow manager
    const flowManager = getGoogleOAuthFlowManager();
    const accounts = await flowManager.listAvailableAccounts(
      connectionId,
      clientId
    );
    
    console.log('[Google Accounts API] ✅ Contas carregadas:', accounts.length);
    
    return NextResponse.json({
      success: true,
      accounts,
      message: `${accounts.length} conta(s) Google Ads encontrada(s)`,
    });
    
  } catch (error: any) {
    console.error('[Google Accounts API] ❌ Erro:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao buscar contas',
        details: error.message 
      },
      { status: 500 }
    );
  }
}