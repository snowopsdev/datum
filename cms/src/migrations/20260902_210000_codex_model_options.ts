import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TYPE "public"."enum_llm_settings_brand_voice_extract_model" ADD VALUE IF NOT EXISTS 'codex/gpt-5.6-sol';
  ALTER TYPE "public"."enum_llm_settings_brand_voice_extract_model" ADD VALUE IF NOT EXISTS 'codex/gpt-5.6-terra';
  ALTER TYPE "public"."enum_llm_settings_brand_voice_extract_model" ADD VALUE IF NOT EXISTS 'codex/gpt-5.6-luna';
  ALTER TYPE "public"."enum_llm_settings_brand_voice_extract_model" ADD VALUE IF NOT EXISTS 'codex/gpt-5.5';
  ALTER TYPE "public"."enum_llm_settings_brand_voice_extract_model" ADD VALUE IF NOT EXISTS 'codex/gpt-5.4';
  ALTER TYPE "public"."enum_llm_settings_brand_voice_extract_model" ADD VALUE IF NOT EXISTS 'codex/gpt-5.4-mini';
  ALTER TYPE "public"."enum_llm_settings_claim_extraction_model" ADD VALUE IF NOT EXISTS 'codex/gpt-5.6-sol';
  ALTER TYPE "public"."enum_llm_settings_claim_extraction_model" ADD VALUE IF NOT EXISTS 'codex/gpt-5.6-terra';
  ALTER TYPE "public"."enum_llm_settings_claim_extraction_model" ADD VALUE IF NOT EXISTS 'codex/gpt-5.6-luna';
  ALTER TYPE "public"."enum_llm_settings_claim_extraction_model" ADD VALUE IF NOT EXISTS 'codex/gpt-5.5';
  ALTER TYPE "public"."enum_llm_settings_claim_extraction_model" ADD VALUE IF NOT EXISTS 'codex/gpt-5.4';
  ALTER TYPE "public"."enum_llm_settings_claim_extraction_model" ADD VALUE IF NOT EXISTS 'codex/gpt-5.4-mini';
  ALTER TYPE "public"."enum_llm_settings_evidence_verification_model" ADD VALUE IF NOT EXISTS 'codex/gpt-5.6-sol';
  ALTER TYPE "public"."enum_llm_settings_evidence_verification_model" ADD VALUE IF NOT EXISTS 'codex/gpt-5.6-terra';
  ALTER TYPE "public"."enum_llm_settings_evidence_verification_model" ADD VALUE IF NOT EXISTS 'codex/gpt-5.6-luna';
  ALTER TYPE "public"."enum_llm_settings_evidence_verification_model" ADD VALUE IF NOT EXISTS 'codex/gpt-5.5';
  ALTER TYPE "public"."enum_llm_settings_evidence_verification_model" ADD VALUE IF NOT EXISTS 'codex/gpt-5.4';
  ALTER TYPE "public"."enum_llm_settings_evidence_verification_model" ADD VALUE IF NOT EXISTS 'codex/gpt-5.4-mini';
  ALTER TYPE "public"."enum_llm_settings_fact_check_model" ADD VALUE IF NOT EXISTS 'codex/gpt-5.6-sol';
  ALTER TYPE "public"."enum_llm_settings_fact_check_model" ADD VALUE IF NOT EXISTS 'codex/gpt-5.6-terra';
  ALTER TYPE "public"."enum_llm_settings_fact_check_model" ADD VALUE IF NOT EXISTS 'codex/gpt-5.6-luna';
  ALTER TYPE "public"."enum_llm_settings_fact_check_model" ADD VALUE IF NOT EXISTS 'codex/gpt-5.5';
  ALTER TYPE "public"."enum_llm_settings_fact_check_model" ADD VALUE IF NOT EXISTS 'codex/gpt-5.4';
  ALTER TYPE "public"."enum_llm_settings_fact_check_model" ADD VALUE IF NOT EXISTS 'codex/gpt-5.4-mini';
  ALTER TYPE "public"."enum_llm_settings_generate_model" ADD VALUE IF NOT EXISTS 'codex/gpt-5.6-sol';
  ALTER TYPE "public"."enum_llm_settings_generate_model" ADD VALUE IF NOT EXISTS 'codex/gpt-5.6-terra';
  ALTER TYPE "public"."enum_llm_settings_generate_model" ADD VALUE IF NOT EXISTS 'codex/gpt-5.6-luna';
  ALTER TYPE "public"."enum_llm_settings_generate_model" ADD VALUE IF NOT EXISTS 'codex/gpt-5.5';
  ALTER TYPE "public"."enum_llm_settings_generate_model" ADD VALUE IF NOT EXISTS 'codex/gpt-5.4';
  ALTER TYPE "public"."enum_llm_settings_generate_model" ADD VALUE IF NOT EXISTS 'codex/gpt-5.4-mini';
  ALTER TYPE "public"."enum_llm_settings_information_gain_judge_model" ADD VALUE IF NOT EXISTS 'codex/gpt-5.6-sol';
  ALTER TYPE "public"."enum_llm_settings_information_gain_judge_model" ADD VALUE IF NOT EXISTS 'codex/gpt-5.6-terra';
  ALTER TYPE "public"."enum_llm_settings_information_gain_judge_model" ADD VALUE IF NOT EXISTS 'codex/gpt-5.6-luna';
  ALTER TYPE "public"."enum_llm_settings_information_gain_judge_model" ADD VALUE IF NOT EXISTS 'codex/gpt-5.5';
  ALTER TYPE "public"."enum_llm_settings_information_gain_judge_model" ADD VALUE IF NOT EXISTS 'codex/gpt-5.4';
  ALTER TYPE "public"."enum_llm_settings_information_gain_judge_model" ADD VALUE IF NOT EXISTS 'codex/gpt-5.4-mini';
  ALTER TYPE "public"."enum_llm_settings_qualitative_review_model" ADD VALUE IF NOT EXISTS 'codex/gpt-5.6-sol';
  ALTER TYPE "public"."enum_llm_settings_qualitative_review_model" ADD VALUE IF NOT EXISTS 'codex/gpt-5.6-terra';
  ALTER TYPE "public"."enum_llm_settings_qualitative_review_model" ADD VALUE IF NOT EXISTS 'codex/gpt-5.6-luna';
  ALTER TYPE "public"."enum_llm_settings_qualitative_review_model" ADD VALUE IF NOT EXISTS 'codex/gpt-5.5';
  ALTER TYPE "public"."enum_llm_settings_qualitative_review_model" ADD VALUE IF NOT EXISTS 'codex/gpt-5.4';
  ALTER TYPE "public"."enum_llm_settings_qualitative_review_model" ADD VALUE IF NOT EXISTS 'codex/gpt-5.4-mini';
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  -- Postgres cannot drop an enum value, and narrowing the type would fail on any
  -- row already holding a codex/ model. The added labels stay.
  SELECT 1;
  `)
}
