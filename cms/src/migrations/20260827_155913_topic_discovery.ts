import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "articles_secondary_keywords" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"keyword" varchar NOT NULL
  );
  
  CREATE TABLE "topic_searches" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"seed" varchar NOT NULL,
  	"seed_key" varchar NOT NULL,
  	"country" varchar NOT NULL,
  	"fetched_at" timestamp(3) with time zone NOT NULL,
  	"result_count" numeric,
  	"candidates" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "topic_searches_id" integer;
  ALTER TABLE "articles_secondary_keywords" ADD CONSTRAINT "articles_secondary_keywords_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "articles_secondary_keywords_order_idx" ON "articles_secondary_keywords" USING btree ("_order");
  CREATE INDEX "articles_secondary_keywords_parent_id_idx" ON "articles_secondary_keywords" USING btree ("_parent_id");
  CREATE INDEX "topic_searches_seed_key_idx" ON "topic_searches" USING btree ("seed_key");
  CREATE INDEX "topic_searches_fetched_at_idx" ON "topic_searches" USING btree ("fetched_at");
  CREATE INDEX "topic_searches_updated_at_idx" ON "topic_searches" USING btree ("updated_at");
  CREATE INDEX "topic_searches_created_at_idx" ON "topic_searches" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_topic_searches_fk" FOREIGN KEY ("topic_searches_id") REFERENCES "public"."topic_searches"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_topic_searches_id_idx" ON "payload_locked_documents_rels" USING btree ("topic_searches_id");`)
}

/*
 * `IF EXISTS` on the constraint and index drops: `DROP TABLE … CASCADE` above
 * already removes anything referencing those tables, so the generated
 * unconditional drops fail on objects that are gone by the time they run.
 */
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles_secondary_keywords" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "topic_searches" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "articles_secondary_keywords" CASCADE;
  DROP TABLE "topic_searches" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_topic_searches_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_topic_searches_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "topic_searches_id";`)
}
