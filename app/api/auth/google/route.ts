import { NextResponse } from 'next/server';
import * as oidc from 'openid-client';
import {getAppOrigin,getGoogleAttemptCookieName,getGoogleCallbackUrl,getGoogleClient} from '@/src/auth/google';

export const runtime = 'nodejs';

export async function GET() {
  const appOrigin = getAppOrigin();

  try {
    const client = await getGoogleClient();
    const verifier = oidc.randomPKCECodeVerifier();
    const state = oidc.randomState();
    const nonce = oidc.randomNonce();

    const authorizationUrl = oidc.buildAuthorizationUrl(client, {
      redirect_uri: getGoogleCallbackUrl().href,
      scope: 'openid profile',
      code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
      code_challenge_method: 'S256',
      state,
      nonce,
      prompt: 'select_account',
    });

    const response = NextResponse.redirect(authorizationUrl);
    response.headers.set('Cache-Control', 'no-store');
    response.cookies.set(
      getGoogleAttemptCookieName(),
      JSON.stringify({ verifier, state, nonce }),
      {
        httpOnly: true,
        secure: appOrigin.protocol === 'https:',
        sameSite: 'lax',
        path: '/',
        maxAge: 600,
      },
    );

    return response;
  } catch {
    return new Response('Could not start Google sign-in. Try again.', {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}