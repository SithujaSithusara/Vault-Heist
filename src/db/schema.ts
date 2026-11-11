import type { Buffer } from 'node:buffer';
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  customType,
  foreignKey,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const dateTime = (name: string) => timestamp(name, { withTimezone: true });

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => 'bytea',
});

export const runStatus = pgEnum('run_status', [
  'preparing',
  'active',
  'completed',
  'captured',
  'abandoned',
  'interrupted',
  'session_expired',
]);

export const runRoute = pgEnum('run_route', ['standard', 'fallback']);

export const terminalStatus = pgEnum('terminal_status', [
  'waiting',
  'ready',
  'cooldown',
  'solved',
  'jammed',
]);

export const players = pgTable('player', {
  id: uuid('id').defaultRandom().primaryKey(),
  googleSubject: text('google_subject').notNull().unique(),
  displayName: text('display_name').notNull().default('Monkey Player'),
  createdAt: dateTime('created_at').notNull().defaultNow(),
});

export const appSessions = pgTable('app_session', {
  id: uuid('id').defaultRandom().primaryKey(),
  playerId: uuid('player_id').notNull().references(() => players.id),
  tokenHash: text('token_hash').notNull().unique(),
  createdAt: dateTime('created_at').notNull().defaultNow(),
  expiresAt: dateTime('expires_at').notNull(),
  revokedAt: dateTime('revoked_at'),
}, (table) => [
  unique('app_session_id_player_uq').on(table.id, table.playerId),
  check('app_session_valid_expiry', sql`expires_at > created_at`),
]);

export const heistRuns = pgTable('heist_run', {
  id: uuid('id').defaultRandom().primaryKey(),
  playerId: uuid('player_id').notNull().references(() => players.id),
  sessionId: uuid('session_id').notNull(),
  status: runStatus('status').notNull().default('preparing'),
  route: runRoute('route').notNull().default('standard'),
  createdAt: dateTime('created_at').notNull().defaultNow(),
  startedAt: dateTime('started_at'),
  endedAt: dateTime('ended_at'),
  fallbackChosenAt: dateTime('fallback_chosen_at'),
  vaultOpenedAt: dateTime('vault_opened_at'),
  fruitCollectedAt: dateTime('fruit_collected_at'),
  puzzleAlarmUntil: dateTime('puzzle_alarm_until'),
}, (table) => [
  foreignKey({
    name: 'heist_run_session_owner_fk',
    columns: [table.sessionId, table.playerId],
    foreignColumns: [appSessions.id, appSessions.playerId],
  }),
  uniqueIndex('heist_run_one_open_per_player')
    .on(table.playerId)
    .where(sql`status IN ('preparing', 'active')`),
  check('heist_run_fallback_choice', sql`
    (route = 'fallback') = (fallback_chosen_at IS NOT NULL)
  `),
]);

export const runTerminals = pgTable('run_terminal', {
  runId: uuid('run_id').notNull().references(() => heistRuns.id),
  slot: smallint('slot').notNull(),
  status: terminalStatus('status').notNull().default('waiting'),
  cooldownUntil: dateTime('cooldown_until'),
  solvedDigit: smallint('solved_digit'),
}, (table) => [
  primaryKey({ columns: [table.runId, table.slot] }),
  check('run_terminal_valid_slot', sql`slot BETWEEN 1 AND 3`),
  check('run_terminal_valid_digit', sql`solved_digit BETWEEN 0 AND 9`),
  check('run_terminal_solved_digit_required', sql`
    (status = 'solved') = (solved_digit IS NOT NULL)
  `),
]);

export const puzzleAssignments = pgTable('puzzle_assignment', {
  id: uuid('id').defaultRandom().primaryKey(),
  runId: uuid('run_id').notNull(),
  slot: smallint('slot').notNull(),
  imageBytes: bytea('image_bytes').notNull(),
  imageContentType: text('image_content_type').notNull(),
  solutionDigit: smallint('solution_digit').notNull(),
  assignedAt: dateTime('assigned_at').notNull().defaultNow(),
  retiredAt: dateTime('retired_at'),
}, (table) => [
  foreignKey({
    name: 'puzzle_assignment_terminal_fk',
    columns: [table.runId, table.slot],
    foreignColumns: [runTerminals.runId, runTerminals.slot],
  }),
  uniqueIndex('puzzle_assignment_one_current_per_slot')
    .on(table.runId, table.slot)
    .where(sql`retired_at IS NULL`),
  check('puzzle_assignment_valid_solution', sql`solution_digit BETWEEN 0 AND 9`),
]);

export const puzzleSubmissions = pgTable('puzzle_submission', {
  assignmentId: uuid('assignment_id').notNull()
    .references(() => puzzleAssignments.id),
  requestId: uuid('request_id').notNull(),
  submittedDigit: smallint('submitted_digit').notNull(),
  correct: boolean('correct').notNull(),
  acceptedAt: dateTime('accepted_at').notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.assignmentId, table.requestId] }),
  check('puzzle_submission_valid_digit', sql`submitted_digit BETWEEN 0 AND 9`),
]);

export const heistResults = pgTable('heist_result', {
  runId: uuid('run_id').primaryKey().references(() => heistRuns.id),
  elapsedMs: bigint('elapsed_ms', { mode: 'number' }).notNull(),
  wrongAnswers: integer('wrong_answers').notNull(),
  penaltyMs: bigint('penalty_ms', { mode: 'number' })
    .generatedAlwaysAs(sql`wrong_answers::bigint * 10000`),
  officialMs: bigint('official_ms', { mode: 'number' })
    .generatedAlwaysAs(sql`elapsed_ms + wrong_answers::bigint * 10000`),
  newPersonalBest: boolean('new_personal_best').notNull().default(false),
}, () => [
  check('heist_result_nonnegative_totals', sql`
    elapsed_ms >= 0 AND wrong_answers >= 0
  `),
]);