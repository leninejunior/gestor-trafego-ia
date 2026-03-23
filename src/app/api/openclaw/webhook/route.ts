import { NextRequest, NextResponse } from 'next/server';
import { processOpenClawWebhook } from '@/lib/whatsapp/openclaw-webhook';

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'openclaw-webhook',
    endpoints: {
      openclaw: '/api/openclaw/webhook',
      whatsapp: '/api/whatsapp/webhook'
    },
    requiredEnv: ['WHATSAPP_WEBHOOK_SECRET (optional, recommended)']
  });
}

export async function POST(request: NextRequest) {
  return processOpenClawWebhook(request);
}
