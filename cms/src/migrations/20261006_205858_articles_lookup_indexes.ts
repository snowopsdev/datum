import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE INDEX "articles_slug_idx" ON "articles" USING btree ("slug");
    CREATE INDEX "articles_keyword_idx" ON "articles" USING btree ("keyword");
    CREATE INDEX "articles_status_idx" ON "articles" USING btree ("status");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX "articles_slug_idx";
    DROP INDEX "articles_keyword_idx";
    DROP INDEX "articles_status_idx";`)
}
