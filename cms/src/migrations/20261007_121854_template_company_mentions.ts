import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_templates_company_mentions" AS ENUM('none', 'mention', 'feature');
  ALTER TABLE "templates" ADD COLUMN "company_mentions" "enum_templates_company_mentions" DEFAULT 'mention';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "templates" DROP COLUMN "company_mentions";
  DROP TYPE "public"."enum_templates_company_mentions";`)
}
