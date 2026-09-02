import * as migration_20260826_015027_existing_schema_baseline from './20260826_015027_existing_schema_baseline';
import * as migration_20260826_015044_onboarding_pipeline_runs from './20260826_015044_onboarding_pipeline_runs';
import * as migration_20260826_225347_information_gain_schema from './20260826_225347_information_gain_schema';
import * as migration_20260827_155913_topic_discovery from './20260827_155913_topic_discovery';
import * as migration_20260827_183330_board_selected_runs from './20260827_183330_board_selected_runs';
import * as migration_20260827_184000_article_archived from './20260827_184000_article_archived';
import * as migration_20260827_214532_brief_checkpoint from './20260827_214532_brief_checkpoint';
import * as migration_20260831_190025_webhook_settings_and_delivery_task from './20260831_190025_webhook_settings_and_delivery_task';
import * as migration_20260831_191144_scheduled_publishing from './20260831_191144_scheduled_publishing';
import * as migration_20260902_210000_codex_model_options from './20260902_210000_codex_model_options';

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
  {
    up: migration_20260826_225347_information_gain_schema.up,
    down: migration_20260826_225347_information_gain_schema.down,
    name: '20260826_225347_information_gain_schema',
  },
  {
    up: migration_20260827_155913_topic_discovery.up,
    down: migration_20260827_155913_topic_discovery.down,
    name: '20260827_155913_topic_discovery',
  },
  {
    up: migration_20260827_183330_board_selected_runs.up,
    down: migration_20260827_183330_board_selected_runs.down,
    name: '20260827_183330_board_selected_runs',
  },
  {
    up: migration_20260827_184000_article_archived.up,
    down: migration_20260827_184000_article_archived.down,
    name: '20260827_184000_article_archived',
  },
  {
    up: migration_20260827_214532_brief_checkpoint.up,
    down: migration_20260827_214532_brief_checkpoint.down,
    name: '20260827_214532_brief_checkpoint',
  },
  {
    up: migration_20260831_190025_webhook_settings_and_delivery_task.up,
    down: migration_20260831_190025_webhook_settings_and_delivery_task.down,
    name: '20260831_190025_webhook_settings_and_delivery_task',
  },
  {
    up: migration_20260831_191144_scheduled_publishing.up,
    down: migration_20260831_191144_scheduled_publishing.down,
    name: '20260831_191144_scheduled_publishing'
  },
  {
    up: migration_20260902_210000_codex_model_options.up,
    down: migration_20260902_210000_codex_model_options.down,
    name: '20260902_210000_codex_model_options',
  },
];
