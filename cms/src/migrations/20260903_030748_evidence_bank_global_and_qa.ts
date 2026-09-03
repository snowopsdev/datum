import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * The `evidence-bank` global and the article columns the evidence check writes.
 *
 * `qaModels` is a plain `jsonb` column, so `qaModels.evidenceCheck` needs no
 * schema at all; only `qaResults.evidenceCheck` is a real field group.
 * `evidenceCheck`'s cost-log enum value and its `llm-settings` model column
 * shipped a migration earlier, on purpose: Postgres refuses to use an enum
 * value added in the same transaction, so the schema had to land before the
 * code that writes rows naming it.
 *
 * `down` drops the tables with CASCADE before dropping the types they use, and
 * takes the four article columns with it — an article's evidence citations and
 * evidence verdict mean nothing without the bank they point at.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_evidence_bank_verified_claims_cleared_surfaces" AS ENUM('web', 'blog', 'ads', 'sales', 'social', 'pr');
  CREATE TYPE "public"."enum_evidence_bank_verified_claims_verification_depth" AS ENUM('primary_document', 'reproduced', 'third_party_audit', 'self_reported');
  CREATE TYPE "public"."enum_evidence_bank_rejected_claims_status" AS ENUM('rejected', 'expired');
  CREATE TABLE "evidence_bank_verified_claims_cleared_surfaces" (
  	"order" integer NOT NULL,
  	"parent_id" varchar NOT NULL,
  	"value" "enum_evidence_bank_verified_claims_cleared_surfaces",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "evidence_bank_verified_claims" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"ref" varchar,
  	"claim" varchar NOT NULL,
  	"primary_source" varchar,
  	"source_url" varchar,
  	"source_date" timestamp(3) with time zone,
  	"sample_or_method" varchar,
  	"verification_depth" "enum_evidence_bank_verified_claims_verification_depth",
  	"limits" varchar,
  	"recheck_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "evidence_bank_facts" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"ref" varchar,
  	"fact" varchar NOT NULL,
  	"source" varchar,
  	"owner" varchar,
  	"last_confirmed_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "evidence_bank_rejected_claims" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"ref" varchar,
  	"claim" varchar NOT NULL,
  	"status" "enum_evidence_bank_rejected_claims_status" DEFAULT 'rejected',
  	"reason" varchar,
  	"replacement" varchar
  );
  
  CREATE TABLE "evidence_bank" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"ref_counter" numeric DEFAULT 0,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "articles" ADD COLUMN "evidence_citations" jsonb;
  ALTER TABLE "articles" ADD COLUMN "qa_results_evidence_check_passed" boolean;
  ALTER TABLE "articles" ADD COLUMN "qa_results_evidence_check_notes" varchar;
  ALTER TABLE "articles" ADD COLUMN "qa_results_evidence_check_claims" jsonb;
  ALTER TABLE "evidence_bank_verified_claims_cleared_surfaces" ADD CONSTRAINT "evidence_bank_verified_claims_cleared_surfaces_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."evidence_bank_verified_claims"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "evidence_bank_verified_claims" ADD CONSTRAINT "evidence_bank_verified_claims_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."evidence_bank"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "evidence_bank_facts" ADD CONSTRAINT "evidence_bank_facts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."evidence_bank"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "evidence_bank_rejected_claims" ADD CONSTRAINT "evidence_bank_rejected_claims_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."evidence_bank"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "evidence_bank_verified_claims_cleared_surfaces_order_idx" ON "evidence_bank_verified_claims_cleared_surfaces" USING btree ("order");
  CREATE INDEX "evidence_bank_verified_claims_cleared_surfaces_parent_idx" ON "evidence_bank_verified_claims_cleared_surfaces" USING btree ("parent_id");
  CREATE INDEX "evidence_bank_verified_claims_order_idx" ON "evidence_bank_verified_claims" USING btree ("_order");
  CREATE INDEX "evidence_bank_verified_claims_parent_id_idx" ON "evidence_bank_verified_claims" USING btree ("_parent_id");
  CREATE INDEX "evidence_bank_facts_order_idx" ON "evidence_bank_facts" USING btree ("_order");
  CREATE INDEX "evidence_bank_facts_parent_id_idx" ON "evidence_bank_facts" USING btree ("_parent_id");
  CREATE INDEX "evidence_bank_rejected_claims_order_idx" ON "evidence_bank_rejected_claims" USING btree ("_order");
  CREATE INDEX "evidence_bank_rejected_claims_parent_id_idx" ON "evidence_bank_rejected_claims" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "evidence_bank_verified_claims_cleared_surfaces" CASCADE;
  DROP TABLE "evidence_bank_verified_claims" CASCADE;
  DROP TABLE "evidence_bank_facts" CASCADE;
  DROP TABLE "evidence_bank_rejected_claims" CASCADE;
  DROP TABLE "evidence_bank" CASCADE;
  ALTER TABLE "articles" DROP COLUMN "evidence_citations";
  ALTER TABLE "articles" DROP COLUMN "qa_results_evidence_check_passed";
  ALTER TABLE "articles" DROP COLUMN "qa_results_evidence_check_notes";
  ALTER TABLE "articles" DROP COLUMN "qa_results_evidence_check_claims";
  DROP TYPE "public"."enum_evidence_bank_verified_claims_cleared_surfaces";
  DROP TYPE "public"."enum_evidence_bank_verified_claims_verification_depth";
  DROP TYPE "public"."enum_evidence_bank_rejected_claims_status";`)
}
