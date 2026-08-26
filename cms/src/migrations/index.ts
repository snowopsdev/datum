import * as migration_20260826_013654_onboarding_pipeline_runs from './20260826_013654_onboarding_pipeline_runs';

export const migrations = [
  {
    up: migration_20260826_013654_onboarding_pipeline_runs.up,
    down: migration_20260826_013654_onboarding_pipeline_runs.down,
    name: '20260826_013654_onboarding_pipeline_runs'
  },
];
