import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');

  if (!clientId) {
    return new Response('Client ID is required', { status: 400 });
  }

  const metaAppId = process.env.NEXT_PUBLIC_META_APP_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/meta/oauth/callback`;
  
  // Required permissions for reading ad data
  const scope = 'ads_read,read_insights,business_management';

  // Create a state parameter for CSRF protection
  const state = JSON.stringify({
    csrf: crypto.randomUUID(),
    clientId: clientId,
  });

  // Store state in a temporary cookie
  const cookieStore = await cookies();
  cookieStore.set('meta_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    maxAge: 60 * 10, // 10 minutes
    path: '/',
  });

  const authUrl = new URL('https://www.facebook.com/v19.0/dialog/oauth');
  authUrl.searchParams.set('client_id', metaAppId!);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('scope', scope);

  return NextResponse.redirect(authUrl);
}