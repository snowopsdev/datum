import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * The `codex/*` model ids are gone from the catalog, so a stored selection now
 * names a model nothing can run. Null those selections and each stage falls
 * back to its env override or the platform default, which is what an operator
 * who never chose Codex already gets.
 *
 * The enum labels themselves stay: Postgres cannot drop a value from an enum
 * type, and recreating the nine types would fail on any row still holding one.
 * An unused label costs nothing — the dropdown no longer offers it.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  UPDATE "llm_settings" SET "generate_model" = NULL WHERE "generate_model"::text LIKE 'codex/%';
  UPDATE "llm_settings" SET "fact_check_model" = NULL WHERE "fact_check_model"::text LIKE 'codex/%';
  UPDATE "llm_settings" SET "qualitative_review_model" = NULL WHERE "qualitative_review_model"::text LIKE 'codex/%';
  UPDATE "llm_settings" SET "claim_extraction_model" = NULL WHERE "claim_extraction_model"::text LIKE 'codex/%';
  UPDATE "llm_settings" SET "information_gain_judge_model" = NULL WHERE "information_gain_judge_model"::text LIKE 'codex/%';
  UPDATE "llm_settings" SET "evidence_verification_model" = NULL WHERE "evidence_verification_model"::text LIKE 'codex/%';
  UPDATE "llm_settings" SET "evidence_check_model" = NULL WHERE "evidence_check_model"::text LIKE 'codex/%';
  UPDATE "llm_settings" SET "brand_voice_extract_model" = NULL WHERE "brand_voice_extract_model"::text LIKE 'codex/%';
  UPDATE "llm_settings" SET "setup_assist_model" = NULL WHERE "setup_assist_model"::text LIKE 'codex/%';
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  -- Nothing to undo: which model a stage used before it was cleared is not
  -- recorded anywhere, and the ids it would name cannot run either way.
  SELECT 1;
  `)
}
