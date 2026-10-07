import type { TaskConfig } from 'payload'
import { collectSetupSuggestions } from '../lib/setupSuggestions/collect'
export const CollectSetupSuggestionsTask: TaskConfig<{
  input: object
  output: { created: number; updated: number; obsolete: number }
}> = {
  slug: 'collect-setup-suggestions',
  label: 'Collect setup suggestions',
  retries: 0,
  schedule: [{ cron: '0 0 3 * * *', queue: 'scheduled' }],
  inputSchema: [],
  outputSchema: [
    { name: 'created', type: 'number' },
    { name: 'updated', type: 'number' },
    { name: 'obsolete', type: 'number' },
  ],
  async handler({ req }) {
    return { output: await collectSetupSuggestions(req.payload) }
  },
}
