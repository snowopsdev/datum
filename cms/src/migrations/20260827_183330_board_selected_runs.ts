import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_pipeline_runs_source" ADD VALUE 'selected';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pipeline_runs" ALTER COLUMN "source" SET DATA TYPE text;
  DROP TYPE "public"."enum_pipeline_runs_source";
  CREATE TYPE "public"."enum_pipeline_runs_source" AS ENUM('onboarding', 'admin', 'cli');
  ALTER TABLE "pipeline_runs" ALTER COLUMN "source" SET DATA TYPE "public"."enum_pipeline_runs_source" USING "source"::"public"."enum_pipeline_runs_source";`)
}
