CREATE TYPE "public"."run_route" AS ENUM('standard', 'fallback');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('preparing', 'active', 'completed', 'captured', 'abandoned', 'interrupted', 'session_expired');--> statement-breakpoint
CREATE TYPE "public"."terminal_status" AS ENUM('waiting', 'ready', 'cooldown', 'solved', 'jammed');--> statement-breakpoint
CREATE TABLE "app_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "app_session_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "app_session_id_player_uq" UNIQUE("id","player_id"),
	CONSTRAINT "app_session_valid_expiry" CHECK (expires_at > created_at)
);
--> statement-breakpoint
CREATE TABLE "heist_result" (
	"run_id" uuid PRIMARY KEY NOT NULL,
	"elapsed_ms" bigint NOT NULL,
	"wrong_answers" integer NOT NULL,
	"penalty_ms" bigint GENERATED ALWAYS AS (wrong_answers::bigint * 10000) STORED,
	"official_ms" bigint GENERATED ALWAYS AS (elapsed_ms + wrong_answers::bigint * 10000) STORED,
	"new_personal_best" boolean DEFAULT false NOT NULL,
	CONSTRAINT "heist_result_nonnegative_totals" CHECK (
    elapsed_ms >= 0 AND wrong_answers >= 0
  )
);
--> statement-breakpoint
CREATE TABLE "heist_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"status" "run_status" DEFAULT 'preparing' NOT NULL,
	"route" "run_route" DEFAULT 'standard' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"fallback_chosen_at" timestamp with time zone,
	"vault_opened_at" timestamp with time zone,
	"fruit_collected_at" timestamp with time zone,
	"puzzle_alarm_until" timestamp with time zone,
	CONSTRAINT "heist_run_fallback_choice" CHECK (
    (route = 'fallback') = (fallback_chosen_at IS NOT NULL)
  )
);
--> statement-breakpoint
CREATE TABLE "player" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"google_subject" text NOT NULL,
	"display_name" text DEFAULT 'Monkey Player' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_google_subject_unique" UNIQUE("google_subject")
);
--> statement-breakpoint
CREATE TABLE "puzzle_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"slot" smallint NOT NULL,
	"image_bytes" "bytea" NOT NULL,
	"image_content_type" text NOT NULL,
	"solution_digit" smallint NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retired_at" timestamp with time zone,
	CONSTRAINT "puzzle_assignment_valid_solution" CHECK (solution_digit BETWEEN 0 AND 9)
);
--> statement-breakpoint
CREATE TABLE "puzzle_submission" (
	"assignment_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"submitted_digit" smallint NOT NULL,
	"correct" boolean NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "puzzle_submission_assignment_id_request_id_pk" PRIMARY KEY("assignment_id","request_id"),
	CONSTRAINT "puzzle_submission_valid_digit" CHECK (submitted_digit BETWEEN 0 AND 9)
);
--> statement-breakpoint
CREATE TABLE "run_terminal" (
	"run_id" uuid NOT NULL,
	"slot" smallint NOT NULL,
	"status" "terminal_status" DEFAULT 'waiting' NOT NULL,
	"cooldown_until" timestamp with time zone,
	"solved_digit" smallint,
	CONSTRAINT "run_terminal_run_id_slot_pk" PRIMARY KEY("run_id","slot"),
	CONSTRAINT "run_terminal_valid_slot" CHECK (slot BETWEEN 1 AND 3),
	CONSTRAINT "run_terminal_valid_digit" CHECK (solved_digit BETWEEN 0 AND 9),
	CONSTRAINT "run_terminal_solved_digit_required" CHECK (
    (status = 'solved') = (solved_digit IS NOT NULL)
  )
);
--> statement-breakpoint
ALTER TABLE "app_session" ADD CONSTRAINT "app_session_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heist_result" ADD CONSTRAINT "heist_result_run_id_heist_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."heist_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heist_run" ADD CONSTRAINT "heist_run_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heist_run" ADD CONSTRAINT "heist_run_session_owner_fk" FOREIGN KEY ("session_id","player_id") REFERENCES "public"."app_session"("id","player_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "puzzle_assignment" ADD CONSTRAINT "puzzle_assignment_terminal_fk" FOREIGN KEY ("run_id","slot") REFERENCES "public"."run_terminal"("run_id","slot") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "puzzle_submission" ADD CONSTRAINT "puzzle_submission_assignment_id_puzzle_assignment_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."puzzle_assignment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_terminal" ADD CONSTRAINT "run_terminal_run_id_heist_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."heist_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "heist_run_one_open_per_player" ON "heist_run" USING btree ("player_id") WHERE status IN ('preparing', 'active');--> statement-breakpoint
CREATE UNIQUE INDEX "puzzle_assignment_one_current_per_slot" ON "puzzle_assignment" USING btree ("run_id","slot") WHERE retired_at IS NULL;