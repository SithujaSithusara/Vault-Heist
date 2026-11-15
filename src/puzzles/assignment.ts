import 'server-only';
import { and, count, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/src/db';
import { appSessions, heistRuns, puzzleAssignments, puzzleSubmissions, runTerminals } from '@/src/db/schema';
import { terminalSlots } from '@/src/heists/runs';
import { fetchBananaPuzzle } from './bananaApi';

type RunOwner = {
  playerId: string;
  sessionId: string;
};

export async function prepareTerminalPuzzles(owner: RunOwner, runId: string) {
  const outcomes = await Promise.all(
    terminalSlots.map((slot) => assignTerminalPuzzle(owner, runId, slot, 'preparing')),
  );
  return outcomes.every((outcome) => outcome === 'ready');
}

export async function replaceTerminalPuzzle(owner: RunOwner, runId: string, slot: number) {
  return assignTerminalPuzzle(owner, runId, slot, 'active');
}

async function assignTerminalPuzzle(
  owner: RunOwner,
  runId: string,
  slot: number,
  runStatus: 'preparing' | 'active',
) {
  const ownedRun = and(
    eq(heistRuns.id, runId),
    eq(heistRuns.playerId, owner.playerId),
    eq(heistRuns.sessionId, owner.sessionId),
    eq(heistRuns.status, runStatus),
  );

  const terminalFields = {
    status: runTerminals.status,
    cooldownUntil: runTerminals.cooldownUntil,
  };
  const terminalSlot = and(eq(runTerminals.runId, runId), eq(runTerminals.slot, slot));
  const [terminal] = await db.select(terminalFields)
    .from(heistRuns)
    .innerJoin(runTerminals, and(
      eq(runTerminals.runId, heistRuns.id),
      eq(runTerminals.slot, slot),
    ))
    .where(ownedRun);

  if (!terminal) return 'unavailable';
  if (terminal.status === 'ready') return 'ready';
  const expectedStatus = terminal.status;
  if (expectedStatus !== 'waiting' && expectedStatus !== 'jammed' &&
      (expectedStatus !== 'cooldown' || runStatus !== 'active')) {
    return 'unavailable';
  }
  const cooldownEnd = terminal.cooldownUntil?.getTime();
  if (expectedStatus === 'cooldown' && (cooldownEnd === undefined || cooldownEnd > Date.now())) {
    return 'cooldown';
  }

  let puzzle: Awaited<ReturnType<typeof fetchBananaPuzzle>> | null;
  try {
    puzzle = await fetchBananaPuzzle();
  } catch {
    puzzle = null;
  }

  return db.transaction(async (tx) => {
    const [session] = await tx.select({
      expiresAt: appSessions.expiresAt,
      revokedAt: appSessions.revokedAt,
    })
      .from(appSessions)
      .where(and(
        eq(appSessions.id, owner.sessionId),
        eq(appSessions.playerId, owner.playerId),
      ))
      .for('update');

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      return 'unavailable';
    }

    const [lockedRun] = await tx.select({ id: heistRuns.id })
      .from(heistRuns)
      .where(ownedRun)
      .for('update');

    if (!lockedRun) return 'unavailable';

    const [current] = await tx.select(terminalFields)
      .from(runTerminals)
      .where(terminalSlot);

    if (current?.status === 'ready') return 'ready';
    if (current?.status !== expectedStatus ||
        current.cooldownUntil?.getTime() !== cooldownEnd) {
      return 'unavailable';
    }

    if (!puzzle) {
      await tx.update(runTerminals)
        .set({ status: 'jammed', cooldownUntil: null })
        .where(terminalSlot);
      return 'puzzle-unavailable';
    }

    await tx.insert(puzzleAssignments).values({ runId, slot, ...puzzle });

    await tx.update(runTerminals)
      .set({ status: 'ready', cooldownUntil: null })
      .where(terminalSlot);

    return 'ready';
  });
}

export async function getActivePuzzleImage(owner: RunOwner, assignmentId: string) {
  const [image] = await db.select({
    bytes: puzzleAssignments.imageBytes,
    contentType: puzzleAssignments.imageContentType,
  })
    .from(puzzleAssignments)
    .innerJoin(heistRuns, eq(heistRuns.id, puzzleAssignments.runId))
    .where(and(
      eq(puzzleAssignments.id, assignmentId),
      eq(heistRuns.playerId, owner.playerId),
      eq(heistRuns.sessionId, owner.sessionId),
      eq(heistRuns.status, 'active'),
      isNull(puzzleAssignments.retiredAt),
    ));

  return image ?? null;
}
export async function submitTerminalAnswer(
  owner: RunOwner,
  runId: string,
  assignmentId: string,
  requestId: string,
  digit: number,
) {
  if (!Number.isInteger(digit) || digit < 0 || digit > 9) return 'invalid';

  return db.transaction(async (tx) => {
    const [session] = await tx.select({
      expiresAt: appSessions.expiresAt,
      revokedAt: appSessions.revokedAt,
    })
      .from(appSessions)
      .where(and(
        eq(appSessions.id, owner.sessionId),
        eq(appSessions.playerId, owner.playerId),
      ))
      .for('update');

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      return 'signed-out';
    }

    const [run] = await tx.select({ id: heistRuns.id })
      .from(heistRuns)
      .where(and(
        eq(heistRuns.id, runId),
        eq(heistRuns.playerId, owner.playerId),
        eq(heistRuns.sessionId, owner.sessionId),
        eq(heistRuns.status, 'active'),
      ))
      .for('update');

    if (!run) return 'unavailable';

    const [assignment] = await tx.select({
      slot: puzzleAssignments.slot,
      solutionDigit: puzzleAssignments.solutionDigit,
      retiredAt: puzzleAssignments.retiredAt,
    })
      .from(puzzleAssignments)
      .where(and(
        eq(puzzleAssignments.id, assignmentId),
        eq(puzzleAssignments.runId, run.id),
      ));

    if (!assignment) return 'unavailable';

    const [previous] = await tx.select({
      digit: puzzleSubmissions.submittedDigit,
      correct: puzzleSubmissions.correct,
    })
      .from(puzzleSubmissions)
      .where(and(
        eq(puzzleSubmissions.assignmentId, assignmentId),
        eq(puzzleSubmissions.requestId, requestId),
      ));

    if (previous) {
      if (previous.digit !== digit) return 'unavailable';
      return previous.correct ? 'correct' : 'incorrect';
    }

    if (assignment.retiredAt) return 'unavailable';

    const correct = digit === assignment.solutionDigit;
    await tx.insert(puzzleSubmissions).values({
      assignmentId, requestId, submittedDigit: digit, correct,
    });

    if (correct) {
      await tx.update(runTerminals)
        .set({ status: 'solved', solvedDigit: digit })
        .where(and(eq(runTerminals.runId, runId), eq(runTerminals.slot, assignment.slot)));
      await tx.update(puzzleAssignments)
        .set({ retiredAt: new Date() })
        .where(eq(puzzleAssignments.id, assignmentId));
      return 'correct';
    }

    const now = new Date();
    const alarmUntil = new Date(now.getTime() + 15_000);
    await tx.update(heistRuns)
      .set({ puzzleAlarmUntil: sql`greatest(${heistRuns.puzzleAlarmUntil}, ${alarmUntil.toISOString()}::timestamptz)` })
      .where(eq(heistRuns.id, runId));

    const [attempts] = await tx.select({ misses: count() })
      .from(puzzleSubmissions)
      .where(and(
        eq(puzzleSubmissions.assignmentId, assignmentId),
        eq(puzzleSubmissions.correct, false),
      ));

    if (attempts.misses >= 2) {
      await tx.update(puzzleAssignments)
        .set({ retiredAt: now })
        .where(eq(puzzleAssignments.id, assignmentId));
      await tx.update(runTerminals)
        .set({ status: 'cooldown', cooldownUntil: new Date(now.getTime() + 10_000) })
        .where(and(eq(runTerminals.runId, runId), eq(runTerminals.slot, assignment.slot)));
    }

    return 'incorrect';
  });
}
