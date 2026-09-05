import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Renaming enum labels preserves every stored choice, including null, and
  // avoids rewriting the policy table or its append-only audit history.
  await db.execute(sql`
    ALTER TYPE "public"."enum_information_gain_policy_require_exact_value_match" RENAME VALUE 'true' TO 'enabled';
    ALTER TYPE "public"."enum_information_gain_policy_require_exact_value_match" RENAME VALUE 'false' TO 'disabled';
    ALTER TYPE "public"."enum_information_gain_policy_require_evidence_lineage" RENAME VALUE 'true' TO 'enabled';
    ALTER TYPE "public"."enum_information_gain_policy_require_evidence_lineage" RENAME VALUE 'false' TO 'disabled';
    ALTER TYPE "public"."enum_information_gain_policy_block_first_party_measurements" RENAME VALUE 'true' TO 'enabled';
    ALTER TYPE "public"."enum_information_gain_policy_block_first_party_measurements" RENAME VALUE 'false' TO 'disabled';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "public"."enum_information_gain_policy_require_exact_value_match" RENAME VALUE 'enabled' TO 'true';
    ALTER TYPE "public"."enum_information_gain_policy_require_exact_value_match" RENAME VALUE 'disabled' TO 'false';
    ALTER TYPE "public"."enum_information_gain_policy_require_evidence_lineage" RENAME VALUE 'enabled' TO 'true';
    ALTER TYPE "public"."enum_information_gain_policy_require_evidence_lineage" RENAME VALUE 'disabled' TO 'false';
    ALTER TYPE "public"."enum_information_gain_policy_block_first_party_measurements" RENAME VALUE 'enabled' TO 'true';
    ALTER TYPE "public"."enum_information_gain_policy_block_first_party_measurements" RENAME VALUE 'disabled' TO 'false';
  `)
}
