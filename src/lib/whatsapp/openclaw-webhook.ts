import { NextRequest, NextResponse } from 'next/server';
import { processWhatsAppWebhookEvent } from '@/lib/whatsapp/openclaw-command-handler';
import { apiAuthService } from '@/lib/api/auth-service';

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

async function isApiKeyAuthorized(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !/^Bearer\s+sk_/i.test(authHeader)) {
    return false;
  }

  const validation = await apiAuthService.validateApiKey(request);
  return validation.isValid;
}

export async function isOpenClawWebhookAuthorized(request: NextRequest): Promise<boolean> {
  const expected = process.env.WHATSAPP_WEBHOOK_SECRET?.trim();
  if (!expected) {
    return true;
  }

  const fromHeader =
    request.headers.get('x-whatsapp-webhook-secret') ??
    request.headers.get('x-openclaw-secret') ??
    getBearerToken(request.headers.get('authorization'));

  if (fromHeader === expected) {
    return true;
  }

  return isApiKeyAuthorized(request);
}

export async function processOpenClawWebhook(request: NextRequest): Promise<NextResponse> {
  if (!(await isOpenClawWebhookAuthorized(request))) {
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
