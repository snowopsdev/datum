import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_llm_settings_topic_relevance_model" AS ENUM('claude-fable-5', 'claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano', 'gpt-5', 'gpt-5-mini', 'gpt-5-nano');
  ALTER TYPE "public"."enum_cost_log_stage" ADD VALUE 'topicRelevance';
  ALTER TABLE "topic_searches" ADD COLUMN "relevance" jsonb;
  ALTER TABLE "topic_searches" ADD COLUMN "relevance_fingerprint" varchar;
  ALTER TABLE "topic_searches" ADD COLUMN "relevance_model" varchar;
  ALTER TABLE "llm_settings" ADD COLUMN "topic_relevance_model" "enum_llm_settings_topic_relevance_model";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "cost_log" ALTER COLUMN "stage" SET DATA TYPE text;
  DROP TYPE "public"."enum_cost_log_stage";
  CREATE TYPE "public"."enum_cost_log_stage" AS ENUM('generate', 'factCheck', 'qualitativeReview', 'claimExtraction', 'informationGainJudge', 'evidenceVerification', 'evidenceCheck', 'briefAngle', 'brandVoiceExtract', 'setupAssist');
  ALTER TABLE "cost_log" ALTER COLUMN "stage" SET DATA TYPE "public"."enum_cost_log_stage" USING "stage"::"public"."enum_cost_log_stage";
  ALTER TABLE "topic_searches" DROP COLUMN "relevance";
  ALTER TABLE "topic_searches" DROP COLUMN "relevance_fingerprint";
  ALTER TABLE "topic_searches" DROP COLUMN "relevance_model";
  ALTER TABLE "llm_settings" DROP COLUMN "topic_relevance_model";
  DROP TYPE "public"."enum_llm_settings_topic_relevance_model";`)
}
