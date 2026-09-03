import type { IcpContent, IcpStatus } from '../../lib/tenant/icp'
import type { AssetStep } from './AssetStepper'

/**
 * The audience editor's steps.
 *
 * Ordered as an interview, not as the document: who they are, what hurts, why
 * they would move, how we fix it, who else is talking to them, why us, where
 * they are, and who they are not. Each step's `assist` is the section name
 * from the setup-assistant contract; the review step has none, because there
 * is nothing there for a model to draft.
 */
export type IcpStepId =
  | 'who'
  | 'pains'
  | 'motivation'
  | 'solution'
  | 'competition'
  | 'whyUs'
  | 'channels'
  | 'boundaries'
  | 'review'

export const ICP_STEPS: readonly AssetStep<IcpStepId>[] = [
  {
    id: 'who',
    title: 'Who they are',
    blurb: 'One line a colleague would recognise: the role, the company, the situation.',
    assist: 'who',
  },
  {
    id: 'pains',
    title: 'What hurts',
    blurb:
      'The problems they already feel, each with what makes you sure. Confidence decides whether the writer states it or hedges it.',
    assist: 'pains',
  },
  {
    id: 'motivation',
    title: 'Why they would move',
    blurb: 'What makes this the quarter they act. Mark it as a hypothesis when it is one.',
    assist: 'motivation',
  },
  {
    id: 'solution',
    title: 'How we solve it',
    blurb: 'The mechanism, in their language, plus the lines that have landed before.',
    assist: 'solution',
  },
  {
    id: 'competition',
    title: 'Who else is talking to them',
    blurb: 'What competitors claim, and when they were seen claiming it.',
    assist: 'competition',
  },
  {
    id: 'whyUs',
    title: 'Why us',
    blurb: 'The reason to pick you over the alternative they are already living with.',
    assist: 'whyUs',
  },
  {
    id: 'channels',
    title: 'Where they are',
    blurb: 'Where this audience actually reads, and what they go there for.',
    assist: 'channels',
  },
  {
    id: 'boundaries',
    title: 'Who they are not',
    blurb:
      'People this audience excludes, and what makes an existing customer leave. Both keep drafts honest.',
    assist: 'boundaries',
  },
  {
    id: 'review',
    title: 'Review & activate',
    blurb: 'What is still missing, and whether this audience governs new pieces.',
  },
]

/** One audience as the list and the editor need it. */
export type IcpDTO = IcpContent & {
  id: number
  updatedAt: string
  updatedAtLabel: string
  editHref: string
}

export type IcpListRow = {
  id: number
  name: string
  status: IcpStatus
  primary: boolean
  updatedAtLabel: string
  /** The one-line audience this ICP derives, so the list says what it is for. */
  audienceLine: string
}
