import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { db } from '@/src/db';
import { appSessions, players } from '@/src/db/schema';
import { getAppOrigin } from './google';

const sessionLifetimeMs = 24 * 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function getSessionCookieName() {
  return getAppOrigin().protocol === 'https:'
    ? '__Host-vault-heist-session'
    : 'vault-heist-session';
}

export async function createPlayerSession(
  googleSubject: string,
  givenName: string | undefined,
) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + sessionLifetimeMs);

  await db.transaction(async (tx) => {
    await tx.insert(players)
      .values({
        googleSubject,
        displayName: givenName?.trim() || 'Monkey Player',
      })
      .onConflictDoNothing({ target: players.googleSubject });

    const [player] = await tx.select({ id: players.id })
      .from(players)
      .where(eq(players.googleSubject, googleSubject))
      .limit(1);

    if (!player) {
      throw new Error('Could not load the Google player.');
    }

    await tx.insert(appSessions).values({
      playerId: player.id,
      tokenHash: hashToken(token),
      expiresAt,
    });
  });

  return { token, expiresAt };
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;

  if (!token) {
    return null;
  }

  const [session] = await db.select({
    sessionId: appSessions.id,
    playerId: players.id,
    displayName: players.displayName,
  })
    .from(appSessions)
    .innerJoin(players, eq(appSessions.playerId, players.id))
    .where(and(
      eq(appSessions.tokenHash, hashToken(token)),
      gt(appSessions.expiresAt, new Date()),
      isNull(appSessions.revokedAt),
    ))
    .limit(1);

  return session ?? null;
}