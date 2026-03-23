import { NextRequest, NextResponse } from 'next/server';
import { syncOpenClawMetaData } from '@/lib/whatsapp/openclaw-meta-sync-service';

type SyncRequestParams = {
  clientId?: string;
  daysLookback?: number;
  maxConnections?: number;
};

function getCronSecret(): string | null {
  return process.env.CRON_SECRET?.trim() || process.env.WHATSAPP_WEBHOOK_SECRET?.trim() || null;
}

function isAuthorized(request: NextRequest): boolean {
  const expected = getCronSecret();
  if (!expected) {
    return false;
  }

  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${expected}`;
}

function parseNumberParam(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseGetParams(request: NextRequest): SyncRequestParams {
  const { searchParams } = new URL(request.url);
  return {
    clientId: searchParams.get('clientId') ?? undefined,
    daysLookback: parseNumberParam(searchParams.get('daysLookback')),
    maxConnections: parseNumberParam(searchParams.get('maxConnections'))
  };
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await syncOpenClawMetaData(parseGetParams(request));
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[OpenClaw Meta Sync] GET error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido na sincronizacao'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: SyncRequestParams = {};
  try {
    body = (await request.json()) as SyncRequestParams;
  } catch {
    body = {};
  }

  try {
    const result = await syncOpenClawMetaData({
      clientId: body.clientId,
      daysLookback: body.daysLookback,
      maxConnections: body.maxConnections
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[OpenClaw Meta Sync] POST error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido na sincronizacao'
      },
      { status: 500 }
    );
  }
}
