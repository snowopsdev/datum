'use client'

import React from 'react'

import type { PanelProps } from '../types'
import { RunNextStagePanel } from './RunNextStagePanel'

/**
 * `topic_selected` is a runnable status like any other; what makes it its own
 * entry in `PANEL_FOR_STATUS` is the template select the run panel folds in.
 * Kept as a named panel so the registry reads as one panel per status rather
 * than one panel with a status check inside it.
 */
export function TopicSelectedPanel(props: PanelProps) {
  return <RunNextStagePanel {...props} />
}
