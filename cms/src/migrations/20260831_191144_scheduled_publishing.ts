import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'publish-due';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'publish-due';
  CREATE TABLE "payload_jobs_stats" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"stats" jsonb,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "articles" ADD COLUMN "publish_at" timestamp(3) with time zone;
  ALTER TABLE "payload_jobs" ADD COLUMN "meta" jsonb;
  CREATE INDEX "articles_publish_at_idx" ON "articles" USING btree ("publish_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   -- Rows carrying the removed task slug would fail the enum-narrowing cast
  -- below and abort the rollback, so they go first.
  DELETE FROM "payload_jobs_log" WHERE "task_slug" = 'publish-due';
  DELETE FROM "payload_jobs" WHERE "task_slug" = 'publish-due';
  ALTER TABLE "payload_jobs_stats" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payload_jobs_stats" CASCADE;
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'content-run', 'webhook-deliver');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'content-run', 'webhook-deliver');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  DROP INDEX "articles_publish_at_idx";
  ALTER TABLE "articles" DROP COLUMN "publish_at";
  ALTER TABLE "payload_jobs" DROP COLUMN "meta";`)
}
