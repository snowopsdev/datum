import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_articles_status" AS ENUM('topic_selected', 'researched', 'drafted', 'qa_passed', 'needs_revision', 'approved', 'published');
  CREATE TYPE "public"."enum_cost_log_stage" AS ENUM('generate', 'factCheck', 'qualitativeReview', 'brandVoiceExtract');
  CREATE TYPE "public"."enum_article_audit_actor_type" AS ENUM('pipeline', 'user', 'system');
  CREATE TYPE "public"."enum_brand_voices_status" AS ENUM('draft', 'active', 'archived');
  CREATE TYPE "public"."enum_brand_voices_source" AS ENUM('onboarding', 'upload');
  CREATE TYPE "public"."enum_brand_voices_audience_language_level" AS ENUM('plain', 'general', 'professional', 'expert');
  CREATE TYPE "public"."enum_governance_audit_actor_type" AS ENUM('pipeline', 'user', 'system');
  CREATE TYPE "public"."enum_pipeline_runs_source" AS ENUM('onboarding', 'admin', 'cli');
  CREATE TYPE "public"."enum_pipeline_runs_status" AS ENUM('queued', 'running', 'succeeded', 'failed');
  CREATE TYPE "public"."enum_pipeline_runs_mode" AS ENUM('mock', 'live');
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'content-run');
  CREATE TYPE "public"."enum_payload_jobs_log_state" AS ENUM('failed', 'succeeded');
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'content-run');
  CREATE TYPE "public"."enum_llm_settings_generate_model" AS ENUM('claude-fable-5', 'claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano', 'gpt-5', 'gpt-5-mini', 'gpt-5-nano');
  CREATE TYPE "public"."enum_llm_settings_fact_check_model" AS ENUM('claude-fable-5', 'claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano', 'gpt-5', 'gpt-5-mini', 'gpt-5-nano');
  CREATE TYPE "public"."enum_llm_settings_qualitative_review_model" AS ENUM('claude-fable-5', 'claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano', 'gpt-5', 'gpt-5-mini', 'gpt-5-nano');
  CREATE TYPE "public"."enum_llm_settings_brand_voice_extract_model" AS ENUM('claude-fable-5', 'claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano', 'gpt-5', 'gpt-5-mini', 'gpt-5-nano');
  CREATE TABLE "users_sessions" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "created_at" timestamp(3) with time zone,
    "expires_at" timestamp(3) with time zone NOT NULL
  );

  CREATE TABLE "users" (
    "id" serial PRIMARY KEY NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "email" varchar NOT NULL,
    "reset_password_token" varchar,
    "reset_password_expiration" timestamp(3) with time zone,
    "salt" varchar,
    "hash" varchar,
    "login_attempts" numeric DEFAULT 0,
    "lock_until" timestamp(3) with time zone
  );

  CREATE TABLE "media" (
    "id" serial PRIMARY KEY NOT NULL,
    "alt" varchar NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "url" varchar,
    "thumbnail_u_r_l" varchar,
    "filename" varchar,
    "mime_type" varchar,
    "filesize" numeric,
    "width" numeric,
    "height" numeric,
    "focal_x" numeric,
    "focal_y" numeric
  );

  CREATE TABLE "templates_dos" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "text" varchar NOT NULL
  );

  CREATE TABLE "templates_donts" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "text" varchar NOT NULL
  );

  CREATE TABLE "templates_required_sections" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "heading" varchar NOT NULL
  );

  CREATE TABLE "templates" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" varchar NOT NULL,
    "outline" jsonb,
    "example" jsonb,
    "seo_spec_title_tag_max_length" numeric DEFAULT 60,
    "seo_spec_meta_description_max_length" numeric DEFAULT 160,
    "seo_spec_heading_structure_rules" varchar,
    "seo_spec_faq_required" boolean,
    "seo_spec_faq_min_questions" numeric,
    "seo_spec_faq_max_questions" numeric,
    "seo_spec_og_tags_required" boolean,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "articles_research_common_subtopics" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "text" varchar NOT NULL
  );

  CREATE TABLE "articles_research_related_questions" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "text" varchar NOT NULL
  );

  CREATE TABLE "articles_faq_items" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "question" varchar NOT NULL,
    "answer" varchar NOT NULL
  );

  CREATE TABLE "articles" (
    "id" serial PRIMARY KEY NOT NULL,
    "title" varchar,
    "slug" varchar,
    "keyword" varchar NOT NULL,
    "template_id" integer,
    "research_ranking_pages_summary" varchar,
    "body" jsonb,
    "title_tag" varchar,
    "meta_description" varchar,
    "og_title" varchar,
    "og_description" varchar,
    "og_image" varchar,
    "status" "enum_articles_status" DEFAULT 'topic_selected' NOT NULL,
    "qa_results_structural_passed" boolean,
    "qa_results_structural_violations" jsonb,
    "qa_results_fact_check_passed" boolean,
    "qa_results_fact_check_notes" varchar,
    "qa_results_fact_check_sources" jsonb,
    "qa_results_qualitative_review_passed" boolean,
    "qa_results_qualitative_review_notes" varchar,
    "qa_results_qualitative_review_voice_score" numeric,
    "qa_results_qualitative_review_voice_notes" varchar,
    "qa_results_qualitative_review_not_trait_violations" jsonb,
    "generation_model" varchar,
    "qa_models" jsonb,
    "total_cost_usd" numeric,
    "reviewed_by" varchar,
    "review_notes" varchar,
    "published_at" timestamp(3) with time zone,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "cost_log" (
    "id" serial PRIMARY KEY NOT NULL,
    "pipeline_run_id" varchar NOT NULL,
    "article_id" integer,
    "stage" "enum_cost_log_stage",
    "provider" varchar,
    "model" varchar,
    "input_tokens" numeric,
    "output_tokens" numeric,
    "web_search_requests" numeric,
    "cost_usd" numeric,
    "request" jsonb,
    "response" jsonb,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "article_audit" (
    "id" serial PRIMARY KEY NOT NULL,
    "article_id" integer NOT NULL,
    "event" varchar NOT NULL,
    "summary" varchar NOT NULL,
    "actor_type" "enum_article_audit_actor_type" NOT NULL,
    "actor" varchar NOT NULL,
    "pipeline_run_id" varchar,
    "stage" varchar,
    "from_status" varchar,
    "to_status" varchar,
    "details" jsonb,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "brand_voices_core_values" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "value" varchar NOT NULL,
    "description" varchar
  );

  CREATE TABLE "brand_voices_voice_adjectives" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "adjective" varchar NOT NULL,
    "description" varchar,
    "do_example" varchar,
    "dont_example" varchar
  );

  CREATE TABLE "brand_voices_not_traits" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "trait" varchar NOT NULL,
    "boundary_note" varchar
  );

  CREATE TABLE "brand_voices_preferred_words" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "word" varchar NOT NULL,
    "note" varchar
  );

  CREATE TABLE "brand_voices_banned_words" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "word" varchar NOT NULL,
    "note" varchar
  );

  CREATE TABLE "brand_voices_samples" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "title" varchar,
    "text" varchar NOT NULL
  );

  CREATE TABLE "brand_voices" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" varchar NOT NULL,
    "status" "enum_brand_voices_status" DEFAULT 'draft' NOT NULL,
    "source" "enum_brand_voices_source" DEFAULT 'onboarding' NOT NULL,
    "source_file_id" integer,
    "onboarding_step" numeric DEFAULT 0,
    "activated_at" timestamp(3) with time zone,
    "activated_by" varchar,
    "essence_one_liner" varchar,
    "essence_mission" varchar,
    "audience_description" varchar,
    "audience_language_level" "enum_brand_voices_audience_language_level",
    "audience_interests" varchar,
    "audience_needs" varchar,
    "persona" varchar,
    "voice_in_own_words" varchar,
    "tone_formality" numeric DEFAULT 3,
    "tone_warmth" numeric DEFAULT 3,
    "tone_boldness" numeric DEFAULT 3,
    "tone_energy" numeric DEFAULT 3,
    "extraction_model" varchar,
    "extraction_provider" varchar,
    "extraction_extracted_at" timestamp(3) with time zone,
    "extraction_source_chars" numeric,
    "extraction_warnings" jsonb,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "brand_voice_files" (
    "id" serial PRIMARY KEY NOT NULL,
    "description" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "url" varchar,
    "thumbnail_u_r_l" varchar,
    "filename" varchar,
    "mime_type" varchar,
    "filesize" numeric,
    "width" numeric,
    "height" numeric,
    "focal_x" numeric,
    "focal_y" numeric
  );

  CREATE TABLE "governance_audit" (
    "id" serial PRIMARY KEY NOT NULL,
    "event" varchar NOT NULL,
    "summary" varchar NOT NULL,
    "actor_type" "enum_governance_audit_actor_type" NOT NULL,
    "actor" varchar NOT NULL,
    "from_status" varchar,
    "to_status" varchar,
    "details" jsonb,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "governance_audit_rels" (
    "id" serial PRIMARY KEY NOT NULL,
    "order" integer,
    "parent_id" integer NOT NULL,
    "path" varchar NOT NULL,
    "brand_voices_id" integer
  );

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

  CREATE TABLE "payload_kv" (
    "id" serial PRIMARY KEY NOT NULL,
    "key" varchar NOT NULL,
    "data" jsonb NOT NULL
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

  CREATE TABLE "payload_locked_documents" (
    "id" serial PRIMARY KEY NOT NULL,
    "global_slug" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "payload_locked_documents_rels" (
    "id" serial PRIMARY KEY NOT NULL,
    "order" integer,
    "parent_id" integer NOT NULL,
    "path" varchar NOT NULL,
    "users_id" integer,
    "media_id" integer,
    "templates_id" integer,
    "articles_id" integer,
    "cost_log_id" integer,
    "article_audit_id" integer,
    "brand_voices_id" integer,
    "brand_voice_files_id" integer,
    "governance_audit_id" integer,
    "pipeline_runs_id" integer
  );

  CREATE TABLE "payload_preferences" (
    "id" serial PRIMARY KEY NOT NULL,
    "key" varchar,
    "value" jsonb,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "payload_preferences_rels" (
    "id" serial PRIMARY KEY NOT NULL,
    "order" integer,
    "parent_id" integer NOT NULL,
    "path" varchar NOT NULL,
    "users_id" integer
  );

  CREATE TABLE "payload_migrations" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" varchar,
    "batch" numeric,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "llm_settings" (
    "id" serial PRIMARY KEY NOT NULL,
    "generate_model" "enum_llm_settings_generate_model",
    "fact_check_model" "enum_llm_settings_fact_check_model",
    "qualitative_review_model" "enum_llm_settings_qualitative_review_model",
    "brand_voice_extract_model" "enum_llm_settings_brand_voice_extract_model",
    "updated_at" timestamp(3) with time zone,
    "created_at" timestamp(3) with time zone
  );

  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "templates_dos" ADD CONSTRAINT "templates_dos_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."templates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "templates_donts" ADD CONSTRAINT "templates_donts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."templates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "templates_required_sections" ADD CONSTRAINT "templates_required_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."templates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_research_common_subtopics" ADD CONSTRAINT "articles_research_common_subtopics_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_research_related_questions" ADD CONSTRAINT "articles_research_related_questions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_faq_items" ADD CONSTRAINT "articles_faq_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles" ADD CONSTRAINT "articles_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cost_log" ADD CONSTRAINT "cost_log_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "article_audit" ADD CONSTRAINT "article_audit_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "brand_voices_core_values" ADD CONSTRAINT "brand_voices_core_values_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."brand_voices"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "brand_voices_voice_adjectives" ADD CONSTRAINT "brand_voices_voice_adjectives_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."brand_voices"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "brand_voices_not_traits" ADD CONSTRAINT "brand_voices_not_traits_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."brand_voices"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "brand_voices_preferred_words" ADD CONSTRAINT "brand_voices_preferred_words_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."brand_voices"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "brand_voices_banned_words" ADD CONSTRAINT "brand_voices_banned_words_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."brand_voices"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "brand_voices_samples" ADD CONSTRAINT "brand_voices_samples_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."brand_voices"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "brand_voices" ADD CONSTRAINT "brand_voices_source_file_id_brand_voice_files_id_fk" FOREIGN KEY ("source_file_id") REFERENCES "public"."brand_voice_files"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "governance_audit_rels" ADD CONSTRAINT "governance_audit_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."governance_audit"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "governance_audit_rels" ADD CONSTRAINT "governance_audit_rels_brand_voices_fk" FOREIGN KEY ("brand_voices_id") REFERENCES "public"."brand_voices"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pipeline_runs" ADD CONSTRAINT "pipeline_runs_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pipeline_runs_rels" ADD CONSTRAINT "pipeline_runs_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pipeline_runs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pipeline_runs_rels" ADD CONSTRAINT "pipeline_runs_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_jobs_log" ADD CONSTRAINT "payload_jobs_log_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."payload_jobs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_templates_fk" FOREIGN KEY ("templates_id") REFERENCES "public"."templates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_cost_log_fk" FOREIGN KEY ("cost_log_id") REFERENCES "public"."cost_log"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_article_audit_fk" FOREIGN KEY ("article_audit_id") REFERENCES "public"."article_audit"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_brand_voices_fk" FOREIGN KEY ("brand_voices_id") REFERENCES "public"."brand_voices"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_brand_voice_files_fk" FOREIGN KEY ("brand_voice_files_id") REFERENCES "public"."brand_voice_files"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_governance_audit_fk" FOREIGN KEY ("governance_audit_id") REFERENCES "public"."governance_audit"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pipeline_runs_fk" FOREIGN KEY ("pipeline_runs_id") REFERENCES "public"."pipeline_runs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "templates_dos_order_idx" ON "templates_dos" USING btree ("_order");
  CREATE INDEX "templates_dos_parent_id_idx" ON "templates_dos" USING btree ("_parent_id");
  CREATE INDEX "templates_donts_order_idx" ON "templates_donts" USING btree ("_order");
  CREATE INDEX "templates_donts_parent_id_idx" ON "templates_donts" USING btree ("_parent_id");
  CREATE INDEX "templates_required_sections_order_idx" ON "templates_required_sections" USING btree ("_order");
  CREATE INDEX "templates_required_sections_parent_id_idx" ON "templates_required_sections" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "templates_name_idx" ON "templates" USING btree ("name");
  CREATE INDEX "templates_updated_at_idx" ON "templates" USING btree ("updated_at");
  CREATE INDEX "templates_created_at_idx" ON "templates" USING btree ("created_at");
  CREATE INDEX "articles_research_common_subtopics_order_idx" ON "articles_research_common_subtopics" USING btree ("_order");
  CREATE INDEX "articles_research_common_subtopics_parent_id_idx" ON "articles_research_common_subtopics" USING btree ("_parent_id");
  CREATE INDEX "articles_research_related_questions_order_idx" ON "articles_research_related_questions" USING btree ("_order");
  CREATE INDEX "articles_research_related_questions_parent_id_idx" ON "articles_research_related_questions" USING btree ("_parent_id");
  CREATE INDEX "articles_faq_items_order_idx" ON "articles_faq_items" USING btree ("_order");
  CREATE INDEX "articles_faq_items_parent_id_idx" ON "articles_faq_items" USING btree ("_parent_id");
  CREATE INDEX "articles_template_idx" ON "articles" USING btree ("template_id");
  CREATE INDEX "articles_updated_at_idx" ON "articles" USING btree ("updated_at");
  CREATE INDEX "articles_created_at_idx" ON "articles" USING btree ("created_at");
  CREATE INDEX "cost_log_pipeline_run_id_idx" ON "cost_log" USING btree ("pipeline_run_id");
  CREATE INDEX "cost_log_article_idx" ON "cost_log" USING btree ("article_id");
  CREATE INDEX "cost_log_updated_at_idx" ON "cost_log" USING btree ("updated_at");
  CREATE INDEX "cost_log_created_at_idx" ON "cost_log" USING btree ("created_at");
  CREATE INDEX "article_audit_article_idx" ON "article_audit" USING btree ("article_id");
  CREATE INDEX "article_audit_event_idx" ON "article_audit" USING btree ("event");
  CREATE INDEX "article_audit_pipeline_run_id_idx" ON "article_audit" USING btree ("pipeline_run_id");
  CREATE INDEX "article_audit_updated_at_idx" ON "article_audit" USING btree ("updated_at");
  CREATE INDEX "article_audit_created_at_idx" ON "article_audit" USING btree ("created_at");
  CREATE INDEX "brand_voices_core_values_order_idx" ON "brand_voices_core_values" USING btree ("_order");
  CREATE INDEX "brand_voices_core_values_parent_id_idx" ON "brand_voices_core_values" USING btree ("_parent_id");
  CREATE INDEX "brand_voices_voice_adjectives_order_idx" ON "brand_voices_voice_adjectives" USING btree ("_order");
  CREATE INDEX "brand_voices_voice_adjectives_parent_id_idx" ON "brand_voices_voice_adjectives" USING btree ("_parent_id");
  CREATE INDEX "brand_voices_not_traits_order_idx" ON "brand_voices_not_traits" USING btree ("_order");
  CREATE INDEX "brand_voices_not_traits_parent_id_idx" ON "brand_voices_not_traits" USING btree ("_parent_id");
  CREATE INDEX "brand_voices_preferred_words_order_idx" ON "brand_voices_preferred_words" USING btree ("_order");
  CREATE INDEX "brand_voices_preferred_words_parent_id_idx" ON "brand_voices_preferred_words" USING btree ("_parent_id");
  CREATE INDEX "brand_voices_banned_words_order_idx" ON "brand_voices_banned_words" USING btree ("_order");
  CREATE INDEX "brand_voices_banned_words_parent_id_idx" ON "brand_voices_banned_words" USING btree ("_parent_id");
  CREATE INDEX "brand_voices_samples_order_idx" ON "brand_voices_samples" USING btree ("_order");
  CREATE INDEX "brand_voices_samples_parent_id_idx" ON "brand_voices_samples" USING btree ("_parent_id");
  CREATE INDEX "brand_voices_status_idx" ON "brand_voices" USING btree ("status");
  CREATE INDEX "brand_voices_source_file_idx" ON "brand_voices" USING btree ("source_file_id");
  CREATE INDEX "brand_voices_updated_at_idx" ON "brand_voices" USING btree ("updated_at");
  CREATE INDEX "brand_voices_created_at_idx" ON "brand_voices" USING btree ("created_at");
  CREATE INDEX "brand_voice_files_updated_at_idx" ON "brand_voice_files" USING btree ("updated_at");
  CREATE INDEX "brand_voice_files_created_at_idx" ON "brand_voice_files" USING btree ("created_at");
  CREATE UNIQUE INDEX "brand_voice_files_filename_idx" ON "brand_voice_files" USING btree ("filename");
  CREATE INDEX "governance_audit_event_idx" ON "governance_audit" USING btree ("event");
  CREATE INDEX "governance_audit_updated_at_idx" ON "governance_audit" USING btree ("updated_at");
  CREATE INDEX "governance_audit_created_at_idx" ON "governance_audit" USING btree ("created_at");
  CREATE INDEX "governance_audit_rels_order_idx" ON "governance_audit_rels" USING btree ("order");
  CREATE INDEX "governance_audit_rels_parent_idx" ON "governance_audit_rels" USING btree ("parent_id");
  CREATE INDEX "governance_audit_rels_path_idx" ON "governance_audit_rels" USING btree ("path");
  CREATE INDEX "governance_audit_rels_brand_voices_id_idx" ON "governance_audit_rels" USING btree ("brand_voices_id");
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
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
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
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_templates_id_idx" ON "payload_locked_documents_rels" USING btree ("templates_id");
  CREATE INDEX "payload_locked_documents_rels_articles_id_idx" ON "payload_locked_documents_rels" USING btree ("articles_id");
  CREATE INDEX "payload_locked_documents_rels_cost_log_id_idx" ON "payload_locked_documents_rels" USING btree ("cost_log_id");
  CREATE INDEX "payload_locked_documents_rels_article_audit_id_idx" ON "payload_locked_documents_rels" USING btree ("article_audit_id");
  CREATE INDEX "payload_locked_documents_rels_brand_voices_id_idx" ON "payload_locked_documents_rels" USING btree ("brand_voices_id");
  CREATE INDEX "payload_locked_documents_rels_brand_voice_files_id_idx" ON "payload_locked_documents_rels" USING btree ("brand_voice_files_id");
  CREATE INDEX "payload_locked_documents_rels_governance_audit_id_idx" ON "payload_locked_documents_rels" USING btree ("governance_audit_id");
  CREATE INDEX "payload_locked_documents_rels_pipeline_runs_id_idx" ON "payload_locked_documents_rels" USING btree ("pipeline_runs_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "templates_dos" CASCADE;
  DROP TABLE "templates_donts" CASCADE;
  DROP TABLE "templates_required_sections" CASCADE;
  DROP TABLE "templates" CASCADE;
  DROP TABLE "articles_research_common_subtopics" CASCADE;
  DROP TABLE "articles_research_related_questions" CASCADE;
  DROP TABLE "articles_faq_items" CASCADE;
  DROP TABLE "articles" CASCADE;
  DROP TABLE "cost_log" CASCADE;
  DROP TABLE "article_audit" CASCADE;
  DROP TABLE "brand_voices_core_values" CASCADE;
  DROP TABLE "brand_voices_voice_adjectives" CASCADE;
  DROP TABLE "brand_voices_not_traits" CASCADE;
  DROP TABLE "brand_voices_preferred_words" CASCADE;
  DROP TABLE "brand_voices_banned_words" CASCADE;
  DROP TABLE "brand_voices_samples" CASCADE;
  DROP TABLE "brand_voices" CASCADE;
  DROP TABLE "brand_voice_files" CASCADE;
  DROP TABLE "governance_audit" CASCADE;
  DROP TABLE "governance_audit_rels" CASCADE;
  DROP TABLE "pipeline_runs" CASCADE;
  DROP TABLE "pipeline_runs_rels" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_jobs_log" CASCADE;
  DROP TABLE "payload_jobs" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "llm_settings" CASCADE;
  DROP TYPE "public"."enum_articles_status";
  DROP TYPE "public"."enum_cost_log_stage";
  DROP TYPE "public"."enum_article_audit_actor_type";
  DROP TYPE "public"."enum_brand_voices_status";
  DROP TYPE "public"."enum_brand_voices_source";
  DROP TYPE "public"."enum_brand_voices_audience_language_level";
  DROP TYPE "public"."enum_governance_audit_actor_type";
  DROP TYPE "public"."enum_pipeline_runs_source";
  DROP TYPE "public"."enum_pipeline_runs_status";
  DROP TYPE "public"."enum_pipeline_runs_mode";
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  DROP TYPE "public"."enum_payload_jobs_log_state";
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  DROP TYPE "public"."enum_llm_settings_generate_model";
  DROP TYPE "public"."enum_llm_settings_fact_check_model";
  DROP TYPE "public"."enum_llm_settings_qualitative_review_model";
  DROP TYPE "public"."enum_llm_settings_brand_voice_extract_model";`)
}
