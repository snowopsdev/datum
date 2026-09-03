import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * The `positioning` global, plus the two model slots and two cost-log stages
 * that slices 4 and 5 need.
 *
 * The schema for `evidenceCheck` and `setupAssist` ships here rather than with
 * the code that uses it, so the enum values exist before anything can write a
 * cost row naming them: adding an enum value and using it inside the same
 * transaction is exactly what Postgres refuses.
 *
 * `down` rebuilds `enum_cost_log_stage` without the two new values, so it fails
 * on a database that has already logged one. That is the honest behaviour —
 * those rows are append-only and the alternative is dropping them.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_positioning_open_rulings_status" AS ENUM('open', 'ruled');
  CREATE TYPE "public"."enum_llm_settings_evidence_check_model" AS ENUM('claude-fable-5', 'claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano', 'gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'codex/gpt-5.6-sol', 'codex/gpt-5.6-terra', 'codex/gpt-5.6-luna', 'codex/gpt-5.5', 'codex/gpt-5.4', 'codex/gpt-5.4-mini');
  CREATE TYPE "public"."enum_llm_settings_setup_assist_model" AS ENUM('claude-fable-5', 'claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano', 'gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'codex/gpt-5.6-sol', 'codex/gpt-5.6-terra', 'codex/gpt-5.6-luna', 'codex/gpt-5.5', 'codex/gpt-5.4', 'codex/gpt-5.4-mini');
  ALTER TYPE "public"."enum_cost_log_stage" ADD VALUE 'evidenceCheck' BEFORE 'brandVoiceExtract';
  ALTER TYPE "public"."enum_cost_log_stage" ADD VALUE 'setupAssist';
  CREATE TABLE "positioning_core_claims" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"claim" varchar NOT NULL,
  	"evidence_ref" varchar
  );
  
  CREATE TABLE "positioning_pillars" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"one_line" varchar,
  	"carries" varchar
  );
  
  CREATE TABLE "positioning_descriptor_ladder" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"descriptor" varchar NOT NULL,
  	"note" varchar
  );
  
  CREATE TABLE "positioning_vocabulary_reach_for" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"term" varchar NOT NULL,
  	"note" varchar
  );
  
  CREATE TABLE "positioning_vocabulary_avoid" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"term" varchar NOT NULL,
  	"note" varchar
  );
  
  CREATE TABLE "positioning_open_rulings" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar NOT NULL,
  	"status" "enum_positioning_open_rulings_status" DEFAULT 'open',
  	"ruling" varchar,
  	"ruled_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "positioning" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"category" varchar,
  	"goal" varchar,
  	"promise" varchar,
  	"active_position" varchar,
  	"statement" varchar,
  	"macro_frame" varchar,
  	"landscape" varchar,
  	"enemy" varchar,
  	"archetype" varchar,
  	"essence" varchar,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "llm_settings" ADD COLUMN "evidence_check_model" "enum_llm_settings_evidence_check_model";
  ALTER TABLE "llm_settings" ADD COLUMN "setup_assist_model" "enum_llm_settings_setup_assist_model";
  ALTER TABLE "positioning_core_claims" ADD CONSTRAINT "positioning_core_claims_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."positioning"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "positioning_pillars" ADD CONSTRAINT "positioning_pillars_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."positioning"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "positioning_descriptor_ladder" ADD CONSTRAINT "positioning_descriptor_ladder_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."positioning"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "positioning_vocabulary_reach_for" ADD CONSTRAINT "positioning_vocabulary_reach_for_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."positioning"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "positioning_vocabulary_avoid" ADD CONSTRAINT "positioning_vocabulary_avoid_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."positioning"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "positioning_open_rulings" ADD CONSTRAINT "positioning_open_rulings_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."positioning"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "positioning_core_claims_order_idx" ON "positioning_core_claims" USING btree ("_order");
  CREATE INDEX "positioning_core_claims_parent_id_idx" ON "positioning_core_claims" USING btree ("_parent_id");
  CREATE INDEX "positioning_pillars_order_idx" ON "positioning_pillars" USING btree ("_order");
  CREATE INDEX "positioning_pillars_parent_id_idx" ON "positioning_pillars" USING btree ("_parent_id");
  CREATE INDEX "positioning_descriptor_ladder_order_idx" ON "positioning_descriptor_ladder" USING btree ("_order");
  CREATE INDEX "positioning_descriptor_ladder_parent_id_idx" ON "positioning_descriptor_ladder" USING btree ("_parent_id");
  CREATE INDEX "positioning_vocabulary_reach_for_order_idx" ON "positioning_vocabulary_reach_for" USING btree ("_order");
  CREATE INDEX "positioning_vocabulary_reach_for_parent_id_idx" ON "positioning_vocabulary_reach_for" USING btree ("_parent_id");
  CREATE INDEX "positioning_vocabulary_avoid_order_idx" ON "positioning_vocabulary_avoid" USING btree ("_order");
  CREATE INDEX "positioning_vocabulary_avoid_parent_id_idx" ON "positioning_vocabulary_avoid" USING btree ("_parent_id");
  CREATE INDEX "positioning_open_rulings_order_idx" ON "positioning_open_rulings" USING btree ("_order");
  CREATE INDEX "positioning_open_rulings_parent_id_idx" ON "positioning_open_rulings" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "positioning_core_claims" CASCADE;
  DROP TABLE "positioning_pillars" CASCADE;
  DROP TABLE "positioning_descriptor_ladder" CASCADE;
  DROP TABLE "positioning_vocabulary_reach_for" CASCADE;
  DROP TABLE "positioning_vocabulary_avoid" CASCADE;
  DROP TABLE "positioning_open_rulings" CASCADE;
  DROP TABLE "positioning" CASCADE;
  ALTER TABLE "cost_log" ALTER COLUMN "stage" SET DATA TYPE text;
  DROP TYPE "public"."enum_cost_log_stage";
  CREATE TYPE "public"."enum_cost_log_stage" AS ENUM('generate', 'factCheck', 'qualitativeReview', 'claimExtraction', 'informationGainJudge', 'evidenceVerification', 'brandVoiceExtract');
  ALTER TABLE "cost_log" ALTER COLUMN "stage" SET DATA TYPE "public"."enum_cost_log_stage" USING "stage"::"public"."enum_cost_log_stage";
  ALTER TABLE "llm_settings" DROP COLUMN "evidence_check_model";
  ALTER TABLE "llm_settings" DROP COLUMN "setup_assist_model";
  DROP TYPE "public"."enum_positioning_open_rulings_status";
  DROP TYPE "public"."enum_llm_settings_evidence_check_model";
  DROP TYPE "public"."enum_llm_settings_setup_assist_model";`)
}
