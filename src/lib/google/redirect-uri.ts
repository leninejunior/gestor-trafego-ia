/**
 * Returns the canonical Google OAuth redirect URI used by the app.
 * Falls back to NEXT_PUBLIC_APP_URL + /api/google/callback and normalizes
 * legacy callback2 suffixes to avoid redirect_uri_mismatch.
 */
export function getCanonicalGoogleRedirectUri(): string {
  const configuredRedirectUri = (process.env.GOOGLE_REDIRECT_URI || '').trim();
  const baseAppUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
    .trim()
    .replace(/\/+$/, '');

  const candidate = configuredRedirectUri || `${baseAppUrl}/api/google/callback`;

  return candidate.replace(/\/api\/google\/callback2\/?$/i, '/api/google/callback');
}

