import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * The `icps` collection — the audiences this workspace writes for — plus the
 * `articles.icp` relationship that points a piece at one of them, and the
 * `icps` leg on the governance audit's polymorphic subject.
 *
 * Each `confidence` select gets its own Postgres enum type, one per array row
 * and group that carries one. That is Payload's shape for a `select`, and it
 * is the price of the admin dropdown; adding a seventh confidence level later
 * means one `ALTER TYPE … ADD VALUE` per type.
 *
 * The generated `down` was edited: it dropped the `icps` tables with `CASCADE`
 * and then tried to drop the foreign-key constraints that cascade had already
 * removed, so rolling back failed on `constraint … does not exist`. The
 * constraint and index drops are `IF EXISTS` now, which is what makes the
 * round-trip in `migrations.int.spec.ts` pass.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_icps_pains_confidence" AS ENUM('verified', 'strong_directional', 'qualitative_pattern', 'cultural_signal', 'inference', 'hypothesis');
  CREATE TYPE "public"."enum_icps_competition_confidence" AS ENUM('verified', 'strong_directional', 'qualitative_pattern', 'cultural_signal', 'inference', 'hypothesis');
  CREATE TYPE "public"."enum_icps_channels_confidence" AS ENUM('verified', 'strong_directional', 'qualitative_pattern', 'cultural_signal', 'inference', 'hypothesis');
  CREATE TYPE "public"."enum_icps_status" AS ENUM('draft', 'active', 'archived');
  CREATE TYPE "public"."enum_icps_motivation_confidence" AS ENUM('verified', 'strong_directional', 'qualitative_pattern', 'cultural_signal', 'inference', 'hypothesis');
  CREATE TYPE "public"."enum_icps_solution_confidence" AS ENUM('verified', 'strong_directional', 'qualitative_pattern', 'cultural_signal', 'inference', 'hypothesis');
  CREATE TYPE "public"."enum_icps_why_us_confidence" AS ENUM('verified', 'strong_directional', 'qualitative_pattern', 'cultural_signal', 'inference', 'hypothesis');
  CREATE TABLE "icps_pains_evidence" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"ref" varchar NOT NULL,
  	"note" varchar
  );
  
  CREATE TABLE "icps_pains" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"statement" varchar NOT NULL,
  	"confidence" "enum_icps_pains_confidence"
  );
  
  CREATE TABLE "icps_solution_sample_lines" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL
  );
  
  CREATE TABLE "icps_competition" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"competitor" varchar NOT NULL,
  	"claim" varchar,
  	"claimed_at" timestamp(3) with time zone,
  	"source" varchar,
  	"confidence" "enum_icps_competition_confidence"
  );
  
  CREATE TABLE "icps_channels" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"channel" varchar NOT NULL,
  	"note" varchar,
  	"confidence" "enum_icps_channels_confidence"
  );
  
  CREATE TABLE "icps_churn_triggers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL
  );
  
  CREATE TABLE "icps_not_our_user" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL
  );
  
  CREATE TABLE "icps" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"status" "enum_icps_status" DEFAULT 'draft' NOT NULL,
  	"primary" boolean DEFAULT false,
  	"activated_at" timestamp(3) with time zone,
  	"activated_by" varchar,
  	"who" varchar,
  	"motivation_text" varchar,
  	"motivation_hypothesis" boolean DEFAULT false,
  	"motivation_confidence" "enum_icps_motivation_confidence",
  	"solution_mechanism" varchar,
  	"solution_confidence" "enum_icps_solution_confidence",
  	"why_us_text" varchar,
  	"why_us_confidence" "enum_icps_why_us_confidence",
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "articles" ADD COLUMN "icp_id" integer;
  ALTER TABLE "governance_audit_rels" ADD COLUMN "icps_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "icps_id" integer;
  ALTER TABLE "icps_pains_evidence" ADD CONSTRAINT "icps_pains_evidence_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."icps_pains"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "icps_pains" ADD CONSTRAINT "icps_pains_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."icps"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "icps_solution_sample_lines" ADD CONSTRAINT "icps_solution_sample_lines_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."icps"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "icps_competition" ADD CONSTRAINT "icps_competition_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."icps"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "icps_channels" ADD CONSTRAINT "icps_channels_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."icps"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "icps_churn_triggers" ADD CONSTRAINT "icps_churn_triggers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."icps"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "icps_not_our_user" ADD CONSTRAINT "icps_not_our_user_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."icps"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "icps_pains_evidence_order_idx" ON "icps_pains_evidence" USING btree ("_order");
  CREATE INDEX "icps_pains_evidence_parent_id_idx" ON "icps_pains_evidence" USING btree ("_parent_id");
  CREATE INDEX "icps_pains_order_idx" ON "icps_pains" USING btree ("_order");
  CREATE INDEX "icps_pains_parent_id_idx" ON "icps_pains" USING btree ("_parent_id");
  CREATE INDEX "icps_solution_sample_lines_order_idx" ON "icps_solution_sample_lines" USING btree ("_order");
  CREATE INDEX "icps_solution_sample_lines_parent_id_idx" ON "icps_solution_sample_lines" USING btree ("_parent_id");
  CREATE INDEX "icps_competition_order_idx" ON "icps_competition" USING btree ("_order");
  CREATE INDEX "icps_competition_parent_id_idx" ON "icps_competition" USING btree ("_parent_id");
  CREATE INDEX "icps_channels_order_idx" ON "icps_channels" USING btree ("_order");
  CREATE INDEX "icps_channels_parent_id_idx" ON "icps_channels" USING btree ("_parent_id");
  CREATE INDEX "icps_churn_triggers_order_idx" ON "icps_churn_triggers" USING btree ("_order");
  CREATE INDEX "icps_churn_triggers_parent_id_idx" ON "icps_churn_triggers" USING btree ("_parent_id");
  CREATE INDEX "icps_not_our_user_order_idx" ON "icps_not_our_user" USING btree ("_order");
  CREATE INDEX "icps_not_our_user_parent_id_idx" ON "icps_not_our_user" USING btree ("_parent_id");
  CREATE INDEX "icps_status_idx" ON "icps" USING btree ("status");
  CREATE INDEX "icps_primary_idx" ON "icps" USING btree ("primary");
  CREATE INDEX "icps_updated_at_idx" ON "icps" USING btree ("updated_at");
  CREATE INDEX "icps_created_at_idx" ON "icps" USING btree ("created_at");
  ALTER TABLE "articles" ADD CONSTRAINT "articles_icp_id_icps_id_fk" FOREIGN KEY ("icp_id") REFERENCES "public"."icps"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "governance_audit_rels" ADD CONSTRAINT "governance_audit_rels_icps_fk" FOREIGN KEY ("icps_id") REFERENCES "public"."icps"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_icps_fk" FOREIGN KEY ("icps_id") REFERENCES "public"."icps"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "articles_icp_idx" ON "articles" USING btree ("icp_id");
  CREATE INDEX "governance_audit_rels_icps_id_idx" ON "governance_audit_rels" USING btree ("icps_id");
  CREATE INDEX "payload_locked_documents_rels_icps_id_idx" ON "payload_locked_documents_rels" USING btree ("icps_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "icps_pains_evidence" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "icps_pains" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "icps_solution_sample_lines" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "icps_competition" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "icps_channels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "icps_churn_triggers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "icps_not_our_user" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "icps" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "icps_pains_evidence" CASCADE;
  DROP TABLE "icps_pains" CASCADE;
  DROP TABLE "icps_solution_sample_lines" CASCADE;
  DROP TABLE "icps_competition" CASCADE;
  DROP TABLE "icps_channels" CASCADE;
  DROP TABLE "icps_churn_triggers" CASCADE;
  DROP TABLE "icps_not_our_user" CASCADE;
  DROP TABLE "icps" CASCADE;
  ALTER TABLE "articles" DROP CONSTRAINT IF EXISTS "articles_icp_id_icps_id_fk";
  ALTER TABLE "governance_audit_rels" DROP CONSTRAINT IF EXISTS "governance_audit_rels_icps_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_icps_fk";
  DROP INDEX IF EXISTS "articles_icp_idx";
  DROP INDEX IF EXISTS "governance_audit_rels_icps_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_icps_id_idx";
  ALTER TABLE "articles" DROP COLUMN "icp_id";
  ALTER TABLE "governance_audit_rels" DROP COLUMN "icps_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "icps_id";
  DROP TYPE "public"."enum_icps_pains_confidence";
  DROP TYPE "public"."enum_icps_competition_confidence";
  DROP TYPE "public"."enum_icps_channels_confidence";
  DROP TYPE "public"."enum_icps_status";
  DROP TYPE "public"."enum_icps_motivation_confidence";
  DROP TYPE "public"."enum_icps_solution_confidence";
  DROP TYPE "public"."enum_icps_why_us_confidence";`)
}
