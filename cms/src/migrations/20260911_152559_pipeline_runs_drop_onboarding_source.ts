import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * `onboarding` is gone as a pipeline-run source (Task 1 removed the demo it
 * fed), so a stored run with that source no longer matches anything the
 * collection's `source` select offers. Map those rows to `admin`, the source
 * every other discovery run already uses.
 *
 * The enum label itself stays: Postgres cannot drop a value from an enum
 * type, and recreating it would fail on any row still holding one while this
 * migration runs. An unused label costs nothing — the dropdown no longer
 * offers it.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  UPDATE "pipeline_runs" SET "source" = 'admin' WHERE "source" = 'onboarding';
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  -- Nothing to undo: which rows were originally 'onboarding' is not recorded
  -- anywhere, and the source no longer runs either way.
  `)
}
