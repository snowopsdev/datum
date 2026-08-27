import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_articles_brief_sections_source" AS ENUM('template', 'research', 'editor');
  ALTER TYPE "public"."enum_articles_status" ADD VALUE 'brief_review' BEFORE 'researched';
  CREATE TABLE "articles_brief_sections" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar NOT NULL,
  	"notes" varchar,
  	"source" "enum_articles_brief_sections_source"
  );
  
  ALTER TABLE "templates" ADD COLUMN "intent" varchar;
  ALTER TABLE "articles" ADD COLUMN "brief_angle" varchar;
  ALTER TABLE "articles" ADD COLUMN "brief_audience" varchar;
  ALTER TABLE "articles" ADD COLUMN "brief_must_cover" jsonb;
  ALTER TABLE "articles" ADD COLUMN "brief_opportunities" jsonb;
  ALTER TABLE "articles" ADD COLUMN "brief_notes" varchar;
  ALTER TABLE "articles" ADD COLUMN "brief_approved_at" timestamp(3) with time zone;
  ALTER TABLE "articles" ADD COLUMN "brief_approved_by" varchar;
  ALTER TABLE "articles_brief_sections" ADD CONSTRAINT "articles_brief_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "articles_brief_sections_order_idx" ON "articles_brief_sections" USING btree ("_order");
  CREATE INDEX "articles_brief_sections_parent_id_idx" ON "articles_brief_sections" USING btree ("_parent_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "articles_brief_sections" CASCADE;
  ALTER TABLE "articles" ALTER COLUMN "status" SET DATA TYPE text;
  ALTER TABLE "articles" ALTER COLUMN "status" SET DEFAULT 'topic_selected'::text;
  DROP TYPE "public"."enum_articles_status";
  CREATE TYPE "public"."enum_articles_status" AS ENUM('topic_selected', 'researched', 'drafted', 'qa_passed', 'verified', 'needs_review', 'blocked', 'needs_revision', 'approved', 'published');
  ALTER TABLE "articles" ALTER COLUMN "status" SET DEFAULT 'topic_selected'::"public"."enum_articles_status";
  ALTER TABLE "articles" ALTER COLUMN "status" SET DATA TYPE "public"."enum_articles_status" USING "status"::"public"."enum_articles_status";
  ALTER TABLE "templates" DROP COLUMN "intent";
  ALTER TABLE "articles" DROP COLUMN "brief_angle";
  ALTER TABLE "articles" DROP COLUMN "brief_audience";
  ALTER TABLE "articles" DROP COLUMN "brief_must_cover";
  ALTER TABLE "articles" DROP COLUMN "brief_opportunities";
  ALTER TABLE "articles" DROP COLUMN "brief_notes";
  ALTER TABLE "articles" DROP COLUMN "brief_approved_at";
  ALTER TABLE "articles" DROP COLUMN "brief_approved_by";
  DROP TYPE "public"."enum_articles_brief_sections_source";`)
}
