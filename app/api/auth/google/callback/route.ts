import { NextResponse, type NextRequest } from 'next/server';
import * as oidc from 'openid-client';
import {getAppOrigin,getGoogleAttemptCookieName,getGoogleCallbackUrl,getGoogleClient} from '@/src/auth/google';
import {createPlayerSession,getSessionCookieName} from '@/src/auth/sessions';

export const runtime = 'nodejs';

type SignInAttempt = {
  verifier: string;
  state: string;
  nonce: string;
};

function isSignInAttempt(value: unknown): value is SignInAttempt {
  return typeof value === 'object' && value !== null &&
    'verifier' in value && typeof value.verifier === 'string' &&
    'state' in value && typeof value.state === 'string' &&
    'nonce' in value && typeof value.nonce === 'string';
}

export async function GET(request: NextRequest) {
  const appOrigin = getAppOrigin();
  const attemptCookie = getGoogleAttemptCookieName();
  const cookieOptions = {
    httpOnly: true,
    secure: appOrigin.protocol === 'https:',
    sameSite: 'lax' as const,
    path: '/',
  };

  function redirectTo(path: string) {
    const response = NextResponse.redirect(new URL(path, appOrigin));
    response.headers.set('Cache-Control', 'no-store');
    response.cookies.set(attemptCookie, '', { ...cookieOptions, maxAge: 0 });
    return response;
  }

  try {
    const savedAttempt = request.cookies.get(attemptCookie)?.value;
    if (!savedAttempt) {
      return redirectTo('/?auth=failed');
    }

    const attempt: unknown = JSON.parse(savedAttempt);
    const callbackUrl = getGoogleCallbackUrl();
    callbackUrl.search = request.nextUrl.search;

    if (!isSignInAttempt(attempt) ||
        callbackUrl.searchParams.get('state') !== attempt.state) {
      return redirectTo('/?auth=failed');
    }

    if (callbackUrl.searchParams.get('error') === 'access_denied') {
      return redirectTo('/?auth=cancelled');
    }

    const client = await getGoogleClient();
    oidc.enableNonRepudiationChecks(client);

    const tokens = await oidc.authorizationCodeGrant(client, callbackUrl, {
      expectedState: attempt.state,
      expectedNonce: attempt.nonce,
      pkceCodeVerifier: attempt.verifier,
    });

    const claims = tokens.claims();
    if (!claims?.sub) {
      return redirectTo('/?auth=failed');
    }

    const givenName = typeof claims.given_name === 'string'
      ? claims.given_name
      : undefined;
    const session = await createPlayerSession(claims.sub, givenName);
    const response = redirectTo('/lobby');

    response.cookies.set(getSessionCookieName(), session.token, {
      ...cookieOptions,
      expires: session.expiresAt,
    });

    return response;
  } catch {
    return redirectTo('/?auth=failed');
  }
}