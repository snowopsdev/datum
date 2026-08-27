import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles" ADD COLUMN "archived" boolean DEFAULT false;
  CREATE INDEX "articles_archived_idx" ON "articles" USING btree ("archived");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX IF EXISTS "articles_archived_idx";
  ALTER TABLE "articles" DROP COLUMN "archived";`)
}
