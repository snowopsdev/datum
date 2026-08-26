import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildQueryCluster,
  KEYWORD_WEIGHT,
  RELATED_QUESTION_WEIGHT,
} from '../src/informationGain/lib'

const close = (actual: number, expected: number, tolerance = 1e-9): void => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  )
}

describe('buildQueryCluster', () => {
  it('puts the keyword at q0 and numbers the related questions from q1', () => {
    const cluster = buildQueryCluster('best crm', ['what is a crm?', 'how much does a crm cost?'])
    assert.deepEqual(
      cluster.map((q) => [q.id, q.text, q.kind]),
      [
        ['q0', 'best crm', 'keyword'],
        ['q1', 'what is a crm?', 'related_question'],
        ['q2', 'how much does a crm cost?', 'related_question'],
      ],
    )
  })

  it('normalises the weights to sum to 1', () => {
    const cluster = buildQueryCluster('best crm', ['what is a crm?', 'how much does a crm cost?'])
    const total = KEYWORD_WEIGHT + 2 * RELATED_QUESTION_WEIGHT
    close(cluster[0].weight, KEYWORD_WEIGHT / total)
    close(cluster[1].weight, RELATED_QUESTION_WEIGHT / total)
    close(cluster[2].weight, RELATED_QUESTION_WEIGHT / total)
    close(
      cluster.reduce((sum, q) => sum + q.weight, 0),
      1,
    )
  })

  it('gives the keyword the whole weight when it stands alone', () => {
    const cluster = buildQueryCluster('best crm', [])
    assert.equal(cluster.length, 1)
    assert.equal(cluster[0].weight, 1)
  })

  it('drops empty questions, duplicates, and repeats of the keyword', () => {
    const cluster = buildQueryCluster('Best CRM', [
      '  ',
      'best crm',
      'What is a CRM?',
      'what is a crm?',
      '',
    ])
    assert.deepEqual(
      cluster.map((q) => [q.id, q.text]),
      [
        ['q0', 'Best CRM'],
        ['q1', 'What is a CRM?'],
      ],
    )
    close(
      cluster.reduce((sum, q) => sum + q.weight, 0),
      1,
    )
  })

  it('trims the stored text but keeps its original casing', () => {
    const cluster = buildQueryCluster('  Best CRM  ', ['  Why CRM?  '])
    assert.equal(cluster[0].text, 'Best CRM')
    assert.equal(cluster[1].text, 'Why CRM?')
  })

  it('returns an empty cluster when there is nothing to score against', () => {
    assert.deepEqual(buildQueryCluster('   ', ['  ', '']), [])
  })
})
