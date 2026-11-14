import 'server-only';
import { and, count, eq, exists, gt, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@/src/db';
import { appSessions, heistRuns, players, puzzleAssignments, puzzleSubmissions, runTerminals } from '@/src/db/schema';
import { revokeSession } from '../auth/sessions';

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

export async function startHeist(owner: RunOwner, runId:string){
    return db.transaction(async(tx)=> {
        const [session] = await tx.select ({
            expiresAt: appSessions.expiresAt,
            revokedAt: appSessions.revokedAt,
        })
        .from(appSessions)
        .where(and(eq(appSessions.id, owner.sessionId),eq(appSessions.playerId, owner.playerId)))
        .for("update");

        const now = new Date();

        if(!session || session.revokedAt || session.expiresAt <= now) {
      return 'signed-out' as const;
    }

    const [started] = await tx.update(heistRuns)
      .set({ status: 'active', startedAt: now })
      .where(and(
        eq(heistRuns.id, runId),
        eq(heistRuns.playerId, owner.playerId),
        eq(heistRuns.sessionId, owner.sessionId),
        eq(heistRuns.status, 'preparing'),
        isNull(heistRuns.startedAt),
        exists(tx.select({ slot: runTerminals.slot })
          .from(runTerminals)
          .where(and(
            eq(runTerminals.runId, heistRuns.id),
            eq(runTerminals.slot, 1),
            eq(runTerminals.status, 'ready'),
          ))),
      ))
      .returning({ id: heistRuns.id });

    if (started) return 'active' as const;
    const [existing] = await tx.select({ startedAt: heistRuns.startedAt })
      .from(heistRuns)
      .where(and(
        eq(heistRuns.id, runId),
        eq(heistRuns.playerId, owner.playerId),
        eq(heistRuns.sessionId, owner.sessionId),
        eq(heistRuns.status, 'active'),
      ));

    return existing?.startedAt ? 'active' as const : 'unavailable' as const;
  });
}

export async function getActiveHeist(owner: RunOwner, runId: string) {
  const [run] = await db.select({
    startedAt: heistRuns.startedAt,
    solvedDigit: runTerminals.solvedDigit,
    cooldownUntil: runTerminals.cooldownUntil,
    assignmentId: puzzleAssignments.id,
    puzzleAlarmUntil: heistRuns.puzzleAlarmUntil,
    wrongAnswers: sql<number>`(${db.select({ total: count() })
      .from(puzzleSubmissions)
      .innerJoin(puzzleAssignments, eq(puzzleSubmissions.assignmentId, puzzleAssignments.id))
      .where(and(
        eq(puzzleAssignments.runId, heistRuns.id),
        eq(puzzleSubmissions.correct, false),
      ))
      })`.mapWith(Number),
  })
    .from(heistRuns)
    .leftJoin(runTerminals, and(
      eq(runTerminals.runId, heistRuns.id),
      eq(runTerminals.slot, 1),
    ))
    .leftJoin(puzzleAssignments, and(
      eq(puzzleAssignments.runId, heistRuns.id),
      eq(puzzleAssignments.slot, 1),
      isNull(puzzleAssignments.retiredAt),
    ))
    .where(and(
      eq(heistRuns.id, runId),
      eq(heistRuns.playerId, owner.playerId),
      eq(heistRuns.sessionId, owner.sessionId),
      eq(heistRuns.status, 'active'),
    ));

  return run?.startedAt ? { ...run, startedAt: run.startedAt } : null;
}

export async function abandonActiveHeist(owner: RunOwner, runId: string) {
  await db.update(heistRuns)
    .set({ status: 'abandoned', endedAt: new Date() })
    .where(and(
      eq(heistRuns.id, runId),
      eq(heistRuns.playerId, owner.playerId),
      eq(heistRuns.sessionId, owner.sessionId),
      eq(heistRuns.status, 'active'),
    ));
}
    

