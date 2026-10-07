import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_llm_settings_brief_angle_model" AS ENUM('claude-fable-5', 'claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano', 'gpt-5', 'gpt-5-mini', 'gpt-5-nano');
  ALTER TYPE "public"."enum_cost_log_stage" ADD VALUE 'briefAngle' BEFORE 'brandVoiceExtract';
  ALTER TABLE "articles" ADD COLUMN "brief_angle_options" jsonb;
  ALTER TABLE "llm_settings" ADD COLUMN "brief_angle_model" "enum_llm_settings_brief_angle_model";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "cost_log" ALTER COLUMN "stage" SET DATA TYPE text;
  DROP TYPE "public"."enum_cost_log_stage";
  CREATE TYPE "public"."enum_cost_log_stage" AS ENUM('generate', 'factCheck', 'qualitativeReview', 'claimExtraction', 'informationGainJudge', 'evidenceVerification', 'evidenceCheck', 'brandVoiceExtract', 'setupAssist');
  ALTER TABLE "cost_log" ALTER COLUMN "stage" SET DATA TYPE "public"."enum_cost_log_stage" USING "stage"::"public"."enum_cost_log_stage";
  ALTER TABLE "articles" DROP COLUMN "brief_angle_options";
  ALTER TABLE "llm_settings" DROP COLUMN "brief_angle_model";
  DROP TYPE "public"."enum_llm_settings_brief_angle_model";`)
}
