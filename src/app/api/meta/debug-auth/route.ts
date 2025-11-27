import { NextRequest, NextResponse } from 'next/server';
import { META_CONFIG, META_SCOPES, META_OAUTH_URL } from '@/lib/meta/config';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');

  const diagnostics = {
    timestamp: new Date().toISOString(),
    config: {
      APP_ID: META_CONFIG.APP_ID ? '✓ presente' : '✗ ausente',
      APP_SECRET: META_CONFIG.APP_SECRET ? '✓ presente' : '✗ ausente',
      API_VERSION: META_CONFIG.API_VERSION,
      OAUTH_URL: META_OAUTH_URL,
      SCOPES: META_SCOPES,
    },
    environment: {
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      NODE_ENV: process.env.NODE_ENV,
    },
    request: {
      clientId: clientId || 'não fornecido',
      redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/meta/callback`,
    },
    authUrl: null as string | null,
  };

  try {
    if (!clientId) {
      return NextResponse.json({
        ...diagnostics,
        error: 'clientId é obrigatório',
      }, { status: 400 });
    }

    const state = encodeURIComponent(JSON.stringify({
      clientId,
      clientName: 'Debug Test',
      timestamp: Date.now()
    }));

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/meta/callback`;

    const authUrl = new URL(META_OAUTH_URL);
    authUrl.searchParams.set('client_id', META_CONFIG.APP_ID);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', META_SCOPES.join(','));
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', state);

    diagnostics.authUrl = authUrl.toString();

    return NextResponse.json(diagnostics);
  } catch (error: any) {
    return NextResponse.json({
      ...diagnostics,
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
