import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');

  if (!clientId) {
    return new Response('Client ID is required', { status: 400 });
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/google/oauth/callback`
  );

  const scopes = [
    'https://www.googleapis.com/auth/adwords',
  ];

  const state = JSON.stringify({
    csrf: crypto.randomUUID(),
    clientId: clientId,
  });

  const cookieStore = await cookies();
  cookieStore.set('google_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    maxAge: 60 * 10, // 10 minutes
    path: '/',
  });

  const authorizationUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Necessário para obter um refresh_token
    scope: scopes,
    state: state,
    prompt: 'consent', // Garante que o refresh_token seja sempre retornado
  });

  return NextResponse.redirect(authorizationUrl);
}