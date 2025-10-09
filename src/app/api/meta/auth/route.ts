import { NextRequest, NextResponse } from 'next/server';
import { META_CONFIG, META_SCOPES, META_OAUTH_URL } from '@/lib/meta/config';

// Gerar URL de autorização do Meta
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');
  
  if (!clientId) {
    return NextResponse.json({ error: 'Client ID é obrigatório' }, { status: 400 });
  }

  const state = `client_${clientId}_${Date.now()}`;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/meta/callback`;
  
  const authUrl = new URL(META_OAUTH_URL);
  authUrl.searchParams.set('client_id', META_CONFIG.APP_ID);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', META_SCOPES.join(','));
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', state);

  return NextResponse.json({ authUrl: authUrl.toString() });
}