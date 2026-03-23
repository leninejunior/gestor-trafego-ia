import { NextRequest, NextResponse } from 'next/server';
import { processWhatsAppWebhookEvent } from '@/lib/whatsapp/openclaw-command-handler';

function getBearerToken(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const match = value.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return null;
  }

  return match[1].trim();
}

function mapResultStatusToHttp(status: 'ignored' | 'rejected' | 'executed' | 'failed'): number {
  if (status === 'executed') {
    return 200;
  }

  if (status === 'ignored') {
    return 202;
  }

  if (status === 'rejected') {
    return 403;
  }

  return 500;
}

export function isOpenClawWebhookAuthorized(request: NextRequest): boolean {
  const expected = process.env.WHATSAPP_WEBHOOK_SECRET?.trim();
  if (!expected) {
    return true;
  }

  const fromHeader =
    request.headers.get('x-whatsapp-webhook-secret') ??
    request.headers.get('x-openclaw-secret') ??
    getBearerToken(request.headers.get('authorization'));

  return fromHeader === expected;
}

export async function processOpenClawWebhook(request: NextRequest): Promise<NextResponse> {
  if (!isOpenClawWebhookAuthorized(request)) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Nao autorizado para webhook do OpenClaw.'
      },
      { status: 401 }
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: 'Payload JSON invalido.'
      },
      { status: 400 }
    );
  }

  const result = await processWhatsAppWebhookEvent(payload);
  return NextResponse.json(result, { status: mapResultStatusToHttp(result.status) });
}
