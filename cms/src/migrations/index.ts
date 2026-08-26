import * as migration_20260826_015027_existing_schema_baseline from './20260826_015027_existing_schema_baseline'
import * as migration_20260826_015044_onboarding_pipeline_runs from './20260826_015044_onboarding_pipeline_runs'

export const migrations = [
  {
    up: migration_20260826_015027_existing_schema_baseline.up,
    down: migration_20260826_015027_existing_schema_baseline.down,
    name: '20260826_015027_existing_schema_baseline',
  },
  {
    up: migration_20260826_015044_onboarding_pipeline_runs.up,
    down: migration_20260826_015044_onboarding_pipeline_runs.down,
    name: '20260826_015044_onboarding_pipeline_runs',
  },
]
