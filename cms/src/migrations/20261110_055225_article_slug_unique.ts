import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Article slugs become unique. Existing duplicates are resolved first: within
 * each group of rows sharing a slug, the earliest (lowest id) keeps it and
 * every later row gets `-<id>` appended. That can itself be taken (ids 1, 2, 3
 * with slugs `guide`, `guide`, `guide-2` would give two `guide-2`), so each
 * replacement is checked against every slug in the table, including the ones
 * this loop has already assigned, and gets `-2`, `-3`, … more until it is
 * free. Empty slugs become NULL, the value the `uniqueArticleSlug` hook writes
 * for "no slug", since the index allows any number of NULLs but only one ''.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   UPDATE "articles" SET "slug" = NULL WHERE "slug" = '';
  DO $slugs$
  DECLARE
    dup record;
    base text;
    candidate text;
    n integer;
  BEGIN
    FOR dup IN
      SELECT "id", "slug" FROM (
        SELECT "id", "slug", row_number() OVER (PARTITION BY "slug" ORDER BY "id") AS rn
        FROM "articles"
        WHERE "slug" IS NOT NULL
      ) AS d
      WHERE d.rn > 1
      ORDER BY "id"
    LOOP
      base := dup."slug" || '-' || dup."id";
      candidate := base;
      n := 1;
      WHILE EXISTS (SELECT 1 FROM "articles" WHERE "slug" = candidate) LOOP
        n := n + 1;
        candidate := base || '-' || n;
      END LOOP;
      UPDATE "articles" SET "slug" = candidate WHERE "id" = dup."id";
    END LOOP;
  END
  $slugs$;
  DROP INDEX IF EXISTS "articles_slug_idx";
  CREATE UNIQUE INDEX "articles_slug_idx" ON "articles" USING btree ("slug");`)
}

/** Back to a plain index. The renamed duplicates keep their new slugs. */
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX IF EXISTS "articles_slug_idx";
  CREATE INDEX "articles_slug_idx" ON "articles" USING btree ("slug");`)
}
