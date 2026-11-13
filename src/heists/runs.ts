import 'server-only';
import { and, eq, gt, inArray, isNull } from 'drizzle-orm';
import { db } from '@/src/db';
import { appSessions, heistRuns, players, runTerminals } from '@/src/db/schema';

type RunOwner = {
  playerId: string;
  sessionId: string;
};

const terminalSlots = [1, 2, 3] as const;
const openStatuses = ['preparing', 'active'] as const;

export async function prepareHeist(owner: RunOwner) {
  return db.transaction(async (tx) => {
    await tx.select({ id: players.id })
      .from(players)
      .where(eq(players.id, owner.playerId))
      .for('update');

    const now = new Date();
    const [currentSession] = await tx.select({ id: appSessions.id })
      .from(appSessions)
      .where(and(
        eq(appSessions.id, owner.sessionId),
        eq(appSessions.playerId, owner.playerId),
        gt(appSessions.expiresAt, now),
        isNull(appSessions.revokedAt),
      ))
      .for('update');

    if (!currentSession) {
      return { kind: 'signed-out' } as const;
    }

    const [openRun] = await tx.select({
      id: heistRuns.id,
      sessionId: heistRuns.sessionId,
      status: heistRuns.status,
    })
      .from(heistRuns)
      .where(and(
        eq(heistRuns.playerId, owner.playerId),
        inArray(heistRuns.status, openStatuses),
      ));

    if (openRun?.sessionId === owner.sessionId) {
      return openRun.status === 'preparing'
        ? { kind: 'prepared', runId: openRun.id } as const
        : { kind: 'conflict' } as const;
    }

    if (openRun) {
      const [oldSession] = await tx.select({ id: appSessions.id })
        .from(appSessions)
        .where(and(
          eq(appSessions.id, openRun.sessionId),
          gt(appSessions.expiresAt, now),
          isNull(appSessions.revokedAt),
        ));

      if (oldSession) {
        return { kind: 'conflict' } as const;
      }

      await tx.update(heistRuns)
        .set({ status: 'session_expired', endedAt: now })
        .where(and(
          eq(heistRuns.id, openRun.id),
          inArray(heistRuns.status, openStatuses),
        ));
    }

    const [run] = await tx.insert(heistRuns)
      .values({
        playerId: owner.playerId,
        sessionId: owner.sessionId,
      })
      .returning({ id: heistRuns.id });

    await tx.insert(runTerminals).values(
      terminalSlots.map((slot) => ({ runId: run.id, slot })),
    );

    return { kind: 'prepared', runId: run.id } as const;
  });
}

export async function getPreparingHeist(owner: RunOwner, runId: string) {
  const rows = await db.select({ slot: runTerminals.slot })
    .from(heistRuns)
    .innerJoin(runTerminals, eq(runTerminals.runId, heistRuns.id))
    .where(and(
      eq(heistRuns.id, runId),
      eq(heistRuns.playerId, owner.playerId),
      eq(heistRuns.sessionId, owner.sessionId),
      eq(heistRuns.status, 'preparing'),
    ))
    .orderBy(runTerminals.slot);

  return rows.length === terminalSlots.length ? rows : null;
}

export async function cancelPreparation(owner: RunOwner, runId: string) {
  await db.update(heistRuns)
    .set({ status: 'abandoned', endedAt: new Date() })
    .where(and(
      eq(heistRuns.id, runId),
      eq(heistRuns.playerId, owner.playerId),
      eq(heistRuns.sessionId, owner.sessionId),
      eq(heistRuns.status, 'preparing'),
    ));
}