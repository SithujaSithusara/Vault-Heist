import 'server-only';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/src/db';
import { appSessions, heistRuns, puzzleAssignments, puzzleSubmissions, runTerminals } from '@/src/db/schema';
import { fetchBananaPuzzle } from './bananaApi';

type RunOwner = {
  playerId: string;
  sessionId: string;
};

export async function getTerminalOneAssignment(
  owner: RunOwner,
  runId: string,
) {
  const [assignment] = await db
    .select({ id: puzzleAssignments.id })
    .from(puzzleAssignments)
    .innerJoin(heistRuns, eq(heistRuns.id, puzzleAssignments.runId))
    .where(and(
      eq(heistRuns.id, runId),
      eq(heistRuns.playerId, owner.playerId),
      eq(heistRuns.sessionId, owner.sessionId),
      eq(heistRuns.status, 'active'),
      eq(puzzleAssignments.slot, 1),
      isNull(puzzleAssignments.retiredAt),
    ));

  return assignment ?? null;
}

export async function prepareTerminalOne(owner: RunOwner, runId: string) {
  const ownedPreparation = and(
    eq(heistRuns.id, runId),
    eq(heistRuns.playerId, owner.playerId),
    eq(heistRuns.sessionId, owner.sessionId),
    eq(heistRuns.status, 'preparing'),
  );

  const [terminal] = await db.select({ status: runTerminals.status })
    .from(heistRuns)
    .innerJoin(runTerminals, and(
      eq(runTerminals.runId, heistRuns.id),
      eq(runTerminals.slot, 1),
    ))
    .where(ownedPreparation);

  if (!terminal) return 'unavailable';
  if (terminal.status === 'ready') return 'ready';

  let puzzle: Awaited<ReturnType<typeof fetchBananaPuzzle>>;
  try {
    puzzle = await fetchBananaPuzzle();
  } catch {
    return 'puzzle-unavailable';
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
      .where(ownedPreparation)
      .for('update');

    if (!lockedRun) return 'unavailable';

    const [existing] = await tx.select({ id: puzzleAssignments.id })
      .from(puzzleAssignments)
      .where(and(
        eq(puzzleAssignments.runId, runId),
        eq(puzzleAssignments.slot, 1),
        isNull(puzzleAssignments.retiredAt),
      ));

    if (existing) return 'ready';

    await tx.insert(puzzleAssignments).values({ runId, slot: 1, ...puzzle });

    await tx.update(runTerminals)
      .set({ status: 'ready' })
      .where(and(eq(runTerminals.runId, runId), eq(runTerminals.slot, 1)));

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
export async function submitTerminalOneAnswer(
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
      solutionDigit: puzzleAssignments.solutionDigit,
      retiredAt: puzzleAssignments.retiredAt,
    })
      .from(puzzleAssignments)
      .where(and(
        eq(puzzleAssignments.id, assignmentId),
        eq(puzzleAssignments.runId, run.id),
        eq(puzzleAssignments.slot, 1),
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
        .where(and(eq(runTerminals.runId, runId), eq(runTerminals.slot, 1)));
      await tx.update(puzzleAssignments)
        .set({ retiredAt: new Date() })
        .where(eq(puzzleAssignments.id, assignmentId));
    }

    return correct ? 'correct' : 'incorrect';
  });
}
