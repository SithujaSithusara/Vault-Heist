import 'server-only';
import * as oidc from 'openid-client';

export function getAppOrigin(): URL {
  const value = process.env.APP_ORIGIN;

  if (!value) {
    throw new Error('APP_ORIGIN is missing.');
  }

  return new URL(new URL(value).origin);
}

export function getGoogleCallbackUrl(): URL {
  return new URL('/api/auth/google/callback', getAppOrigin());
}

export function getGoogleAttemptCookieName(): string {
  return getAppOrigin().protocol === 'https:'
    ? '__Host-vault-heist-google'
    : 'vault-heist-google';
}

export async function getGoogleClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials are missing.');
  }

  return oidc.discovery(
    new URL('https://accounts.google.com'),
    clientId,
    clientSecret,
    oidc.ClientSecretPost(clientSecret),
  );
}
