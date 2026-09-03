import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * The `workspace-profile` global: which site this workspace publishes for and
 * which competitors the content-gap report is measured against. Until now both
 * were environment variables; the global makes them editable and the variables
 * become its fallback.
 *
 * The generated diff also proposed re-adding every `codex/*` value to the
 * `llm_settings` model enums, because `20260902_210000_codex_model_options`
 * shipped without a schema snapshot. Those values are already in the database
 * and `ALTER TYPE … ADD VALUE` is not idempotent, so they are dropped here; the
 * snapshot committed alongside this migration carries them, which puts the next
 * generated diff back on solid ground.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "workspace_profile_competitors" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"domain" varchar NOT NULL,
  	"name" varchar
  );
  
  CREATE TABLE "workspace_profile" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"company_name" varchar,
  	"target_domain" varchar,
  	"site_notes" varchar,
  	"site_pages" jsonb,
  	"site_pages_fetched_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "workspace_profile_competitors" ADD CONSTRAINT "workspace_profile_competitors_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."workspace_profile"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "workspace_profile_competitors_order_idx" ON "workspace_profile_competitors" USING btree ("_order");
  CREATE INDEX "workspace_profile_competitors_parent_id_idx" ON "workspace_profile_competitors" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "workspace_profile_competitors" CASCADE;
  DROP TABLE "workspace_profile" CASCADE;`)
}
