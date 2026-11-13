import { NextResponse } from 'next/server';
import { getAppOrigin } from '@/src/auth/google';
import { getCurrentSession } from '@/src/auth/sessions';
import { prepareHeist } from '@/src/heists/runs';

export async function POST(request: Request) {
  const appOrigin = getAppOrigin();
  const headers = { 'Cache-Control': 'no-store' };

  if (request.headers.get('origin') !== appOrigin.origin) {
    return new Response('Forbidden', { status: 403, headers });
  }

  const session = await getCurrentSession();
  const result = session ? await prepareHeist(session) : null;

  if (!result || result.kind === 'signed-out') {
    return NextResponse.redirect(new URL('/', appOrigin), { status: 303, headers });
  }

  const path = result.kind === 'conflict'
    ? '/lobby?heist=already-open'
    : `/heists/prepare?run=${result.runId}`;

  return NextResponse.redirect(new URL(path, appOrigin), { status: 303, headers });
}