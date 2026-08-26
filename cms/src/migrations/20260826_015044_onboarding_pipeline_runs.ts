import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_pipeline_runs_source" AS ENUM('onboarding', 'admin', 'cli');
  CREATE TYPE "public"."enum_pipeline_runs_status" AS ENUM('queued', 'running', 'succeeded', 'failed');
  CREATE TYPE "public"."enum_pipeline_runs_mode" AS ENUM('mock', 'live');
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'content-run');
  CREATE TYPE "public"."enum_payload_jobs_log_state" AS ENUM('failed', 'succeeded');
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'content-run');
  CREATE TABLE "pipeline_runs" (
    "id" serial PRIMARY KEY NOT NULL,
    "run_id" varchar NOT NULL,
    "source" "enum_pipeline_runs_source" NOT NULL,
    "status" "enum_pipeline_runs_status" NOT NULL,
    "mode" "enum_pipeline_runs_mode" NOT NULL,
    "template_id" integer NOT NULL,
    "requested_count" numeric NOT NULL,
    "config_fingerprint" varchar NOT NULL,
    "config_snapshot" jsonb NOT NULL,
    "final_statuses" jsonb,
    "warnings" jsonb,
    "error_summary" varchar,
    "requested_by" varchar NOT NULL,
    "started_at" timestamp(3) with time zone,
    "completed_at" timestamp(3) with time zone,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "pipeline_runs_rels" (
    "id" serial PRIMARY KEY NOT NULL,
    "order" integer,
    "parent_id" integer NOT NULL,
    "path" varchar NOT NULL,
    "articles_id" integer
  );

  CREATE TABLE "payload_jobs_log" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "executed_at" timestamp(3) with time zone NOT NULL,
    "completed_at" timestamp(3) with time zone NOT NULL,
    "task_slug" "enum_payload_jobs_log_task_slug" NOT NULL,
    "task_i_d" varchar NOT NULL,
    "input" jsonb,
    "output" jsonb,
    "state" "enum_payload_jobs_log_state" NOT NULL,
    "error" jsonb
  );

  CREATE TABLE "payload_jobs" (
    "id" serial PRIMARY KEY NOT NULL,
    "input" jsonb,
    "completed_at" timestamp(3) with time zone,
    "total_tried" numeric DEFAULT 0,
    "has_error" boolean DEFAULT false,
    "error" jsonb,
    "task_slug" "enum_payload_jobs_task_slug",
    "queue" varchar DEFAULT 'default',
    "wait_until" timestamp(3) with time zone,
    "processing" boolean DEFAULT false,
    "concurrency_key" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "pipeline_runs_id" integer;
  ALTER TABLE "pipeline_runs" ADD CONSTRAINT "pipeline_runs_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pipeline_runs_rels" ADD CONSTRAINT "pipeline_runs_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pipeline_runs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pipeline_runs_rels" ADD CONSTRAINT "pipeline_runs_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_jobs_log" ADD CONSTRAINT "payload_jobs_log_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."payload_jobs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "pipeline_runs_run_id_idx" ON "pipeline_runs" USING btree ("run_id");
  CREATE INDEX "pipeline_runs_status_idx" ON "pipeline_runs" USING btree ("status");
  CREATE INDEX "pipeline_runs_template_idx" ON "pipeline_runs" USING btree ("template_id");
  CREATE INDEX "pipeline_runs_config_fingerprint_idx" ON "pipeline_runs" USING btree ("config_fingerprint");
  CREATE INDEX "pipeline_runs_updated_at_idx" ON "pipeline_runs" USING btree ("updated_at");
  CREATE INDEX "pipeline_runs_created_at_idx" ON "pipeline_runs" USING btree ("created_at");
  CREATE INDEX "pipeline_runs_rels_order_idx" ON "pipeline_runs_rels" USING btree ("order");
  CREATE INDEX "pipeline_runs_rels_parent_idx" ON "pipeline_runs_rels" USING btree ("parent_id");
  CREATE INDEX "pipeline_runs_rels_path_idx" ON "pipeline_runs_rels" USING btree ("path");
  CREATE INDEX "pipeline_runs_rels_articles_id_idx" ON "pipeline_runs_rels" USING btree ("articles_id");
  CREATE INDEX "payload_jobs_log_order_idx" ON "payload_jobs_log" USING btree ("_order");
  CREATE INDEX "payload_jobs_log_parent_id_idx" ON "payload_jobs_log" USING btree ("_parent_id");
  CREATE INDEX "payload_jobs_completed_at_idx" ON "payload_jobs" USING btree ("completed_at");
  CREATE INDEX "payload_jobs_total_tried_idx" ON "payload_jobs" USING btree ("total_tried");
  CREATE INDEX "payload_jobs_has_error_idx" ON "payload_jobs" USING btree ("has_error");
  CREATE INDEX "payload_jobs_task_slug_idx" ON "payload_jobs" USING btree ("task_slug");
  CREATE INDEX "payload_jobs_queue_idx" ON "payload_jobs" USING btree ("queue");
  CREATE INDEX "payload_jobs_wait_until_idx" ON "payload_jobs" USING btree ("wait_until");
  CREATE INDEX "payload_jobs_processing_idx" ON "payload_jobs" USING btree ("processing");
  CREATE INDEX "payload_jobs_concurrency_key_idx" ON "payload_jobs" USING btree ("concurrency_key");
  CREATE INDEX "payload_jobs_updated_at_idx" ON "payload_jobs" USING btree ("updated_at");
  CREATE INDEX "payload_jobs_created_at_idx" ON "payload_jobs" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pipeline_runs_fk" FOREIGN KEY ("pipeline_runs_id") REFERENCES "public"."pipeline_runs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_pipeline_runs_id_idx" ON "payload_locked_documents_rels" USING btree ("pipeline_runs_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pipeline_runs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pipeline_runs_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_jobs_log" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_jobs" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "pipeline_runs" CASCADE;
  DROP TABLE "pipeline_runs_rels" CASCADE;
  DROP TABLE "payload_jobs_log" CASCADE;
  DROP TABLE "payload_jobs" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_pipeline_runs_fk";

  DROP INDEX "payload_locked_documents_rels_pipeline_runs_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "pipeline_runs_id";
  DROP TYPE "public"."enum_pipeline_runs_source";
  DROP TYPE "public"."enum_pipeline_runs_status";
  DROP TYPE "public"."enum_pipeline_runs_mode";
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  DROP TYPE "public"."enum_payload_jobs_log_state";
  DROP TYPE "public"."enum_payload_jobs_task_slug";`)
}
