/**
 * API para sincronizar saldo real do Meta Ads.
 * Busca saldo direto da API do Meta e atualiza o banco.
 */

import { NextRequest, NextResponse } from 'next/server'
import { syncMetaAdAccountBalances } from '@/lib/balance/sync-meta-ad-account-balances'

export async function POST(_request: NextRequest) {
  try {
    const result = await syncMetaAdAccountBalances()

    return NextResponse.json({
      success: true,
      message: `Sincronizacao concluida: ${result.synced} contas atualizadas`,
      synced: result.synced,
      errors: result.errors,
      totalConnections: result.totalConnections,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Erro na sincronizacao:', error)
    return NextResponse.json(
      {
        error: 'Erro interno na sincronizacao',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
