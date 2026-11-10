import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'recover-stale-runs' BEFORE 'collect-setup-suggestions';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'recover-stale-runs' BEFORE 'collect-setup-suggestions';
  ALTER TABLE "pipeline_runs" ALTER COLUMN "template_id" DROP NOT NULL;
  ALTER TABLE "pipeline_runs" ADD COLUMN "heartbeat_at" timestamp(3) with time zone;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // The old enums cannot hold the new task's jobs, and the old NOT NULL cannot
  // hold a CLI run, which has no template. Both are removed rather than
  // rewritten to something they never were.
  await db.execute(sql`
   DELETE FROM "payload_jobs" WHERE "task_slug" = 'recover-stale-runs';
  DELETE FROM "payload_jobs_log" WHERE "task_slug" = 'recover-stale-runs';
  DELETE FROM "pipeline_runs" WHERE "template_id" IS NULL;
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'content-run', 'webhook-deliver', 'publish-due', 'collect-setup-suggestions');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'content-run', 'webhook-deliver', 'publish-due', 'collect-setup-suggestions');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  ALTER TABLE "pipeline_runs" ALTER COLUMN "template_id" SET NOT NULL;
  ALTER TABLE "pipeline_runs" DROP COLUMN "heartbeat_at";`)
}
