import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_setup_suggestions_kind" AS ENUM('banned_word', 'not_trait', 'unbacked_claim', 'rejected_ref');
  CREATE TYPE "public"."enum_setup_suggestions_target" AS ENUM('brand-voice', 'evidence-bank');
  CREATE TYPE "public"."enum_setup_suggestions_status" AS ENUM('open', 'accepted', 'dismissed', 'obsolete');
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'collect-setup-suggestions';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'collect-setup-suggestions';
  CREATE TABLE "setup_suggestions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"kind" "enum_setup_suggestions_kind" DEFAULT 'banned_word',
  	"signature" varchar,
  	"target" "enum_setup_suggestions_target" DEFAULT 'brand-voice',
  	"proposal" jsonb,
  	"occurrences" jsonb,
  	"count" numeric DEFAULT 0,
  	"status" "enum_setup_suggestions_status" DEFAULT 'open',
  	"first_seen_at" timestamp(3) with time zone,
  	"last_seen_at" timestamp(3) with time zone,
  	"decided_by" varchar,
  	"decided_at" timestamp(3) with time zone,
  	"decision_reason" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "setup_suggestion_scan" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"audit_cursor" varchar,
  	"audit_cursor_id" numeric,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "setup_suggestions_id" integer;
  CREATE UNIQUE INDEX "setup_suggestions_signature_idx" ON "setup_suggestions" USING btree ("signature");
  CREATE INDEX "setup_suggestions_status_idx" ON "setup_suggestions" USING btree ("status");
  CREATE INDEX "setup_suggestions_updated_at_idx" ON "setup_suggestions" USING btree ("updated_at");
  CREATE INDEX "setup_suggestions_created_at_idx" ON "setup_suggestions" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_setup_suggestions_fk" FOREIGN KEY ("setup_suggestions_id") REFERENCES "public"."setup_suggestions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_setup_suggestions_id_idx" ON "payload_locked_documents_rels" USING btree ("setup_suggestions_id");`)
}

/*
 * `IF EXISTS` on the constraint, index and column drops: `DROP TABLE … CASCADE`
 * above already removes anything referencing those tables, so the generated
 * unconditional drops fail on objects that are gone by the time they run.
 */
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "setup_suggestions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "setup_suggestion_scan" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "setup_suggestions" CASCADE;
  DROP TABLE "setup_suggestion_scan" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_setup_suggestions_fk";
  
  -- Rows carrying the removed task slug would fail the enum-narrowing cast
  -- below and abort the rollback, so they go first. Job rows are queue state,
  -- not audit records.
  DELETE FROM "payload_jobs_log" WHERE "task_slug" = 'collect-setup-suggestions';
  DELETE FROM "payload_jobs" WHERE "task_slug" = 'collect-setup-suggestions';
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'content-run', 'webhook-deliver', 'publish-due');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'content-run', 'webhook-deliver', 'publish-due');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_setup_suggestions_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "setup_suggestions_id";
  DROP TYPE "public"."enum_setup_suggestions_kind";
  DROP TYPE "public"."enum_setup_suggestions_target";
  DROP TYPE "public"."enum_setup_suggestions_status";`)
}
