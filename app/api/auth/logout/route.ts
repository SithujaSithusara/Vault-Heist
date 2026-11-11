import { NextResponse, type NextRequest } from 'next/server';
import { getAppOrigin } from '@/src/auth/google';
import { getSessionCookieName, revokeSession } from '@/src/auth/sessions';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const appOrigin = getAppOrigin();
  const headers = { 'Cache-Control': 'no-store' };

  if (request.headers.get('origin') !== appOrigin.origin) {
    return new Response('Forbidden', { status: 403, headers });
  }

  const cookieName = getSessionCookieName();
  const token = request.cookies.get(cookieName)?.value;

  try {
    if (token) {
      await revokeSession(token);
    }
  } catch {
    return new Response('Could not sign out. Go back and try again.', {
      status: 503,
      headers,
    });
  }

  const response = NextResponse.redirect(new URL('/', appOrigin), {
    status: 303,
    headers,
  });

  response.cookies.set(cookieName, '', {
    httpOnly: true,
    secure: appOrigin.protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
}