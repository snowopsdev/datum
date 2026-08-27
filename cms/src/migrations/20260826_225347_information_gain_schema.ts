import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_articles_information_gain_decision" AS ENUM('PASS', 'REVISE', 'HUMAN_REVIEW', 'BLOCK');
  CREATE TYPE "public"."enum_evidence_sources_quality_class" AS ENUM('first_party_dataset', 'primary', 'official_docs', 'secondary', 'unverified', 'blocked');
  CREATE TYPE "public"."enum_evidence_source_candidates_status" AS ENUM('pending', 'approved', 'dismissed');
  CREATE TYPE "public"."enum_evidence_source_candidates_suggested_class" AS ENUM('primary', 'official_docs', 'secondary', 'unverified');
  CREATE TYPE "public"."enum_corpus_snapshots_pages_fetch_status" AS ENUM('ok', 'failed', 'skipped');
  CREATE TYPE "public"."enum_corpus_snapshots_status" AS ENUM('complete', 'partial', 'empty');
  CREATE TYPE "public"."enum_information_gain_runs_decision" AS ENUM('PASS', 'REVISE', 'HUMAN_REVIEW', 'BLOCK');
  CREATE TYPE "public"."enum_llm_settings_claim_extraction_model" AS ENUM('claude-fable-5', 'claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano', 'gpt-5', 'gpt-5-mini', 'gpt-5-nano');
  CREATE TYPE "public"."enum_llm_settings_information_gain_judge_model" AS ENUM('claude-fable-5', 'claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano', 'gpt-5', 'gpt-5-mini', 'gpt-5-nano');
  CREATE TYPE "public"."enum_llm_settings_evidence_verification_model" AS ENUM('claude-fable-5', 'claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano', 'gpt-5', 'gpt-5-mini', 'gpt-5-nano');
  CREATE TYPE "public"."enum_information_gain_policy_require_exact_value_match" AS ENUM('true', 'false');
  CREATE TYPE "public"."enum_information_gain_policy_require_evidence_lineage" AS ENUM('true', 'false');
  CREATE TYPE "public"."enum_information_gain_policy_block_first_party_measurements" AS ENUM('true', 'false');
  ALTER TYPE "public"."enum_articles_status" ADD VALUE 'verified' BEFORE 'needs_revision';
  ALTER TYPE "public"."enum_articles_status" ADD VALUE 'needs_review' BEFORE 'needs_revision';
  ALTER TYPE "public"."enum_articles_status" ADD VALUE 'blocked' BEFORE 'needs_revision';
  ALTER TYPE "public"."enum_cost_log_stage" ADD VALUE 'claimExtraction' BEFORE 'brandVoiceExtract';
  ALTER TYPE "public"."enum_cost_log_stage" ADD VALUE 'informationGainJudge' BEFORE 'brandVoiceExtract';
  ALTER TYPE "public"."enum_cost_log_stage" ADD VALUE 'evidenceVerification' BEFORE 'brandVoiceExtract';
  CREATE TABLE "evidence_sources" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"domain" varchar NOT NULL,
  	"quality_class" "enum_evidence_sources_quality_class" NOT NULL,
  	"note" varchar,
  	"active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "evidence_source_candidates" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"domain" varchar NOT NULL,
  	"status" "enum_evidence_source_candidates_status" DEFAULT 'pending' NOT NULL,
  	"suggested_class" "enum_evidence_source_candidates_suggested_class" NOT NULL,
  	"citation_count" numeric,
  	"serp_count" numeric,
  	"domain_rating" numeric,
  	"first_seen_at" timestamp(3) with time zone,
  	"last_seen_at" timestamp(3) with time zone,
  	"sightings" jsonb,
  	"resolved_source_id" integer,
  	"resolved_at" timestamp(3) with time zone,
  	"resolved_by" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "corpus_snapshots_pages" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"position" numeric,
  	"url" varchar NOT NULL,
  	"title" varchar,
  	"domain" varchar,
  	"domain_rating" numeric,
  	"fetch_status" "enum_corpus_snapshots_pages_fetch_status" NOT NULL,
  	"failure_reason" varchar,
  	"chars" numeric,
  	"text_hash" varchar,
  	"text" varchar,
  	"claim_count" numeric,
  	"unverified_excerpt_count" numeric
  );
  
  CREATE TABLE "corpus_snapshots_internal_corpus" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"article_id" integer NOT NULL,
  	"article_updated_at" timestamp(3) with time zone NOT NULL,
  	"claim_count" numeric
  );
  
  CREATE TABLE "corpus_snapshots" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"keyword" varchar NOT NULL,
  	"keyword_key" varchar NOT NULL,
  	"country" varchar NOT NULL,
  	"captured_at" timestamp(3) with time zone NOT NULL,
  	"status" "enum_corpus_snapshots_status" NOT NULL,
  	"pipeline_run_id" varchar,
  	"snapshot_hash" varchar,
  	"models" jsonb,
  	"query_cluster" jsonb,
  	"baseline_claims" jsonb,
  	"facets" jsonb,
  	"gaps" jsonb,
  	"baseline_doc_count" numeric,
  	"failed_page_count" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "information_gain_runs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"article_id" integer NOT NULL,
  	"pipeline_run_id" varchar NOT NULL,
  	"snapshot_id" integer,
  	"policy_version" varchar NOT NULL,
  	"policy" jsonb,
  	"models" jsonb,
  	"decision" "enum_information_gain_runs_decision" NOT NULL,
  	"reasons" jsonb,
  	"baseline_available" boolean,
  	"calibrated" boolean DEFAULT false,
  	"scores_consensus_coverage" numeric,
  	"scores_potential_gain_units" numeric,
  	"scores_verified_gain_units" numeric,
  	"scores_verification_ratio" numeric,
  	"scores_verified_gain_density" numeric,
  	"scores_facet_gain_coverage" numeric,
  	"scores_internal_duplication_rate" numeric,
  	"claim_summary_total_claims" numeric,
  	"claim_summary_materially_novel_claims" numeric,
  	"claim_summary_verified_novel_claims" numeric,
  	"claim_summary_unsupported_novel_claims" numeric,
  	"claim_summary_contradictory_claims" numeric,
  	"claim_summary_first_party_claims" numeric,
  	"claim_ids_blocked" jsonb,
  	"claim_ids_review" jsonb,
  	"claim_ids_materially_novel" jsonb,
  	"claim_ids_verified_novel" jsonb,
  	"claims" jsonb,
  	"token_count" numeric,
  	"cost_usd" numeric,
  	"draft_updated_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "information_gain_policy" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"min_consensus_coverage" numeric,
  	"min_verification_ratio" numeric,
  	"min_novel_factual_integrity" numeric,
  	"min_numeric_temporal_integrity" numeric,
  	"require_exact_value_match" "enum_information_gain_policy_require_exact_value_match",
  	"require_evidence_lineage" "enum_information_gain_policy_require_evidence_lineage",
  	"block_first_party_measurements" "enum_information_gain_policy_block_first_party_measurements",
  	"max_contradiction_probability" numeric,
  	"material_novelty_threshold" numeric,
  	"max_internal_duplication_rate" numeric,
  	"min_verified_novel_claims" numeric,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "articles" ADD COLUMN "research_snapshot_id" integer;
  ALTER TABLE "articles" ADD COLUMN "research_query_cluster" jsonb;
  ALTER TABLE "articles" ADD COLUMN "research_facets" jsonb;
  ALTER TABLE "articles" ADD COLUMN "research_gaps" jsonb;
  ALTER TABLE "articles" ADD COLUMN "information_gain_run_id" integer;
  ALTER TABLE "articles" ADD COLUMN "information_gain_decision" "enum_articles_information_gain_decision";
  ALTER TABLE "articles" ADD COLUMN "information_gain_policy_version" varchar;
  ALTER TABLE "articles" ADD COLUMN "information_gain_consensus_coverage" numeric;
  ALTER TABLE "articles" ADD COLUMN "information_gain_verified_gain_units" numeric;
  ALTER TABLE "articles" ADD COLUMN "information_gain_verification_ratio" numeric;
  ALTER TABLE "articles" ADD COLUMN "information_gain_internal_duplication_rate" numeric;
  ALTER TABLE "articles" ADD COLUMN "information_gain_verified_novel_claims" numeric;
  ALTER TABLE "articles" ADD COLUMN "information_gain_scored_at" timestamp(3) with time zone;
  ALTER TABLE "articles" ADD COLUMN "review_justification" varchar;
  ALTER TABLE "articles" ADD COLUMN "revision_notes" varchar;
  ALTER TABLE "articles" ADD COLUMN "revision_count" numeric DEFAULT 0;
  ALTER TABLE "governance_audit" ADD COLUMN "subject_global" varchar;
  ALTER TABLE "governance_audit_rels" ADD COLUMN "evidence_sources_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "evidence_sources_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "evidence_source_candidates_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "corpus_snapshots_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "information_gain_runs_id" integer;
  ALTER TABLE "llm_settings" ADD COLUMN "claim_extraction_model" "enum_llm_settings_claim_extraction_model";
  ALTER TABLE "llm_settings" ADD COLUMN "information_gain_judge_model" "enum_llm_settings_information_gain_judge_model";
  ALTER TABLE "llm_settings" ADD COLUMN "evidence_verification_model" "enum_llm_settings_evidence_verification_model";
  ALTER TABLE "evidence_source_candidates" ADD CONSTRAINT "evidence_source_candidates_resolved_source_id_evidence_sources_id_fk" FOREIGN KEY ("resolved_source_id") REFERENCES "public"."evidence_sources"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "corpus_snapshots_pages" ADD CONSTRAINT "corpus_snapshots_pages_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."corpus_snapshots"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "corpus_snapshots_internal_corpus" ADD CONSTRAINT "corpus_snapshots_internal_corpus_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "corpus_snapshots_internal_corpus" ADD CONSTRAINT "corpus_snapshots_internal_corpus_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."corpus_snapshots"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "information_gain_runs" ADD CONSTRAINT "information_gain_runs_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "information_gain_runs" ADD CONSTRAINT "information_gain_runs_snapshot_id_corpus_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."corpus_snapshots"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "evidence_sources_domain_idx" ON "evidence_sources" USING btree ("domain");
  CREATE INDEX "evidence_sources_updated_at_idx" ON "evidence_sources" USING btree ("updated_at");
  CREATE INDEX "evidence_sources_created_at_idx" ON "evidence_sources" USING btree ("created_at");
  CREATE UNIQUE INDEX "evidence_source_candidates_domain_idx" ON "evidence_source_candidates" USING btree ("domain");
  CREATE INDEX "evidence_source_candidates_status_idx" ON "evidence_source_candidates" USING btree ("status");
  CREATE INDEX "evidence_source_candidates_last_seen_at_idx" ON "evidence_source_candidates" USING btree ("last_seen_at");
  CREATE INDEX "evidence_source_candidates_resolved_source_idx" ON "evidence_source_candidates" USING btree ("resolved_source_id");
  CREATE INDEX "evidence_source_candidates_updated_at_idx" ON "evidence_source_candidates" USING btree ("updated_at");
  CREATE INDEX "evidence_source_candidates_created_at_idx" ON "evidence_source_candidates" USING btree ("created_at");
  CREATE INDEX "corpus_snapshots_pages_order_idx" ON "corpus_snapshots_pages" USING btree ("_order");
  CREATE INDEX "corpus_snapshots_pages_parent_id_idx" ON "corpus_snapshots_pages" USING btree ("_parent_id");
  CREATE INDEX "corpus_snapshots_internal_corpus_order_idx" ON "corpus_snapshots_internal_corpus" USING btree ("_order");
  CREATE INDEX "corpus_snapshots_internal_corpus_parent_id_idx" ON "corpus_snapshots_internal_corpus" USING btree ("_parent_id");
  CREATE INDEX "corpus_snapshots_internal_corpus_article_idx" ON "corpus_snapshots_internal_corpus" USING btree ("article_id");
  CREATE INDEX "corpus_snapshots_keyword_idx" ON "corpus_snapshots" USING btree ("keyword");
  CREATE INDEX "corpus_snapshots_keyword_key_idx" ON "corpus_snapshots" USING btree ("keyword_key");
  CREATE INDEX "corpus_snapshots_pipeline_run_id_idx" ON "corpus_snapshots" USING btree ("pipeline_run_id");
  CREATE INDEX "corpus_snapshots_updated_at_idx" ON "corpus_snapshots" USING btree ("updated_at");
  CREATE INDEX "corpus_snapshots_created_at_idx" ON "corpus_snapshots" USING btree ("created_at");
  CREATE INDEX "information_gain_runs_article_idx" ON "information_gain_runs" USING btree ("article_id");
  CREATE INDEX "information_gain_runs_pipeline_run_id_idx" ON "information_gain_runs" USING btree ("pipeline_run_id");
  CREATE INDEX "information_gain_runs_snapshot_idx" ON "information_gain_runs" USING btree ("snapshot_id");
  CREATE INDEX "information_gain_runs_decision_idx" ON "information_gain_runs" USING btree ("decision");
  CREATE INDEX "information_gain_runs_updated_at_idx" ON "information_gain_runs" USING btree ("updated_at");
  CREATE INDEX "information_gain_runs_created_at_idx" ON "information_gain_runs" USING btree ("created_at");
  ALTER TABLE "articles" ADD CONSTRAINT "articles_research_snapshot_id_corpus_snapshots_id_fk" FOREIGN KEY ("research_snapshot_id") REFERENCES "public"."corpus_snapshots"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "articles" ADD CONSTRAINT "articles_information_gain_run_id_information_gain_runs_id_fk" FOREIGN KEY ("information_gain_run_id") REFERENCES "public"."information_gain_runs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "governance_audit_rels" ADD CONSTRAINT "governance_audit_rels_evidence_sources_fk" FOREIGN KEY ("evidence_sources_id") REFERENCES "public"."evidence_sources"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_evidence_sources_fk" FOREIGN KEY ("evidence_sources_id") REFERENCES "public"."evidence_sources"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_evidence_source_candidates_fk" FOREIGN KEY ("evidence_source_candidates_id") REFERENCES "public"."evidence_source_candidates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_corpus_snapshots_fk" FOREIGN KEY ("corpus_snapshots_id") REFERENCES "public"."corpus_snapshots"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_information_gain_runs_fk" FOREIGN KEY ("information_gain_runs_id") REFERENCES "public"."information_gain_runs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "articles_research_research_snapshot_idx" ON "articles" USING btree ("research_snapshot_id");
  CREATE INDEX "articles_information_gain_information_gain_run_idx" ON "articles" USING btree ("information_gain_run_id");
  CREATE INDEX "governance_audit_subject_global_idx" ON "governance_audit" USING btree ("subject_global");
  CREATE INDEX "governance_audit_rels_evidence_sources_id_idx" ON "governance_audit_rels" USING btree ("evidence_sources_id");
  CREATE INDEX "payload_locked_documents_rels_evidence_sources_id_idx" ON "payload_locked_documents_rels" USING btree ("evidence_sources_id");
  CREATE INDEX "payload_locked_documents_rels_evidence_source_candidates_idx" ON "payload_locked_documents_rels" USING btree ("evidence_source_candidates_id");
  CREATE INDEX "payload_locked_documents_rels_corpus_snapshots_id_idx" ON "payload_locked_documents_rels" USING btree ("corpus_snapshots_id");
  CREATE INDEX "payload_locked_documents_rels_information_gain_runs_id_idx" ON "payload_locked_documents_rels" USING btree ("information_gain_runs_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "evidence_sources" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "evidence_source_candidates" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "corpus_snapshots_pages" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "corpus_snapshots_internal_corpus" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "corpus_snapshots" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "information_gain_runs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "information_gain_policy" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "evidence_sources" CASCADE;
  DROP TABLE "evidence_source_candidates" CASCADE;
  DROP TABLE "corpus_snapshots_pages" CASCADE;
  DROP TABLE "corpus_snapshots_internal_corpus" CASCADE;
  DROP TABLE "corpus_snapshots" CASCADE;
  DROP TABLE "information_gain_runs" CASCADE;
  DROP TABLE "information_gain_policy" CASCADE;
  ALTER TABLE "articles" DROP CONSTRAINT IF EXISTS "articles_research_snapshot_id_corpus_snapshots_id_fk";
  
  ALTER TABLE "articles" DROP CONSTRAINT IF EXISTS "articles_information_gain_run_id_information_gain_runs_id_fk";
  
  ALTER TABLE "governance_audit_rels" DROP CONSTRAINT IF EXISTS "governance_audit_rels_evidence_sources_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_evidence_sources_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_evidence_source_candidates_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_corpus_snapshots_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_information_gain_runs_fk";
  
  ALTER TABLE "articles" ALTER COLUMN "status" SET DATA TYPE text;
  ALTER TABLE "articles" ALTER COLUMN "status" SET DEFAULT 'topic_selected'::text;
  DROP TYPE IF EXISTS "public"."enum_articles_status";
  CREATE TYPE "public"."enum_articles_status" AS ENUM('topic_selected', 'researched', 'drafted', 'qa_passed', 'needs_revision', 'approved', 'published');
  ALTER TABLE "articles" ALTER COLUMN "status" SET DEFAULT 'topic_selected'::"public"."enum_articles_status";
  ALTER TABLE "articles" ALTER COLUMN "status" SET DATA TYPE "public"."enum_articles_status" USING "status"::"public"."enum_articles_status";
  ALTER TABLE "cost_log" ALTER COLUMN "stage" SET DATA TYPE text;
  DROP TYPE IF EXISTS "public"."enum_cost_log_stage";
  CREATE TYPE "public"."enum_cost_log_stage" AS ENUM('generate', 'factCheck', 'qualitativeReview', 'brandVoiceExtract');
  ALTER TABLE "cost_log" ALTER COLUMN "stage" SET DATA TYPE "public"."enum_cost_log_stage" USING "stage"::"public"."enum_cost_log_stage";
  DROP INDEX IF EXISTS "articles_research_research_snapshot_idx";
  DROP INDEX IF EXISTS "articles_information_gain_information_gain_run_idx";
  DROP INDEX IF EXISTS "governance_audit_subject_global_idx";
  DROP INDEX IF EXISTS "governance_audit_rels_evidence_sources_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_evidence_sources_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_evidence_source_candidates_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_corpus_snapshots_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_information_gain_runs_id_idx";
  ALTER TABLE "articles" DROP COLUMN IF EXISTS "research_snapshot_id";
  ALTER TABLE "articles" DROP COLUMN IF EXISTS "research_query_cluster";
  ALTER TABLE "articles" DROP COLUMN IF EXISTS "research_facets";
  ALTER TABLE "articles" DROP COLUMN IF EXISTS "research_gaps";
  ALTER TABLE "articles" DROP COLUMN IF EXISTS "information_gain_run_id";
  ALTER TABLE "articles" DROP COLUMN IF EXISTS "information_gain_decision";
  ALTER TABLE "articles" DROP COLUMN IF EXISTS "information_gain_policy_version";
  ALTER TABLE "articles" DROP COLUMN IF EXISTS "information_gain_consensus_coverage";
  ALTER TABLE "articles" DROP COLUMN IF EXISTS "information_gain_verified_gain_units";
  ALTER TABLE "articles" DROP COLUMN IF EXISTS "information_gain_verification_ratio";
  ALTER TABLE "articles" DROP COLUMN IF EXISTS "information_gain_internal_duplication_rate";
  ALTER TABLE "articles" DROP COLUMN IF EXISTS "information_gain_verified_novel_claims";
  ALTER TABLE "articles" DROP COLUMN IF EXISTS "information_gain_scored_at";
  ALTER TABLE "articles" DROP COLUMN IF EXISTS "review_justification";
  ALTER TABLE "articles" DROP COLUMN IF EXISTS "revision_notes";
  ALTER TABLE "articles" DROP COLUMN IF EXISTS "revision_count";
  ALTER TABLE "governance_audit" DROP COLUMN IF EXISTS "subject_global";
  ALTER TABLE "governance_audit_rels" DROP COLUMN IF EXISTS "evidence_sources_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "evidence_sources_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "evidence_source_candidates_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "corpus_snapshots_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "information_gain_runs_id";
  ALTER TABLE "llm_settings" DROP COLUMN IF EXISTS "claim_extraction_model";
  ALTER TABLE "llm_settings" DROP COLUMN IF EXISTS "information_gain_judge_model";
  ALTER TABLE "llm_settings" DROP COLUMN IF EXISTS "evidence_verification_model";
  DROP TYPE IF EXISTS "public"."enum_articles_information_gain_decision";
  DROP TYPE IF EXISTS "public"."enum_evidence_sources_quality_class";
  DROP TYPE IF EXISTS "public"."enum_evidence_source_candidates_status";
  DROP TYPE IF EXISTS "public"."enum_evidence_source_candidates_suggested_class";
  DROP TYPE IF EXISTS "public"."enum_corpus_snapshots_pages_fetch_status";
  DROP TYPE IF EXISTS "public"."enum_corpus_snapshots_status";
  DROP TYPE IF EXISTS "public"."enum_information_gain_runs_decision";
  DROP TYPE IF EXISTS "public"."enum_llm_settings_claim_extraction_model";
  DROP TYPE IF EXISTS "public"."enum_llm_settings_information_gain_judge_model";
  DROP TYPE IF EXISTS "public"."enum_llm_settings_evidence_verification_model";
  DROP TYPE IF EXISTS "public"."enum_information_gain_policy_require_exact_value_match";
  DROP TYPE IF EXISTS "public"."enum_information_gain_policy_require_evidence_lineage";
  DROP TYPE IF EXISTS "public"."enum_information_gain_policy_block_first_party_measurements";`)
}
