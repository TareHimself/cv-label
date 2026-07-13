import { describe, expect, it } from 'vitest'
import { ILabel } from '@shared/types'
import { findLabelIdById, findLabelIdByName } from '../matchLabel'

const labels: ILabel[] = [
  { id: 'l1', name: 'Person', color: '#ff0000' },
  { id: 'l2', name: 'Car', color: '#00ff00' }
]

describe('findLabelIdByName', () => {
  it('matches case-insensitively', () => {
    expect(findLabelIdByName(labels, 'person')).toBe('l1')
    expect(findLabelIdByName(labels, 'PERSON')).toBe('l1')
  })

  it('ignores surrounding whitespace', () => {
    expect(findLabelIdByName(labels, '  car  ')).toBe('l2')
  })

  it('returns undefined when nothing matches', () => {
    expect(findLabelIdByName(labels, 'truck')).toBeUndefined()
  })
})

describe('findLabelIdById', () => {
  it('matches by exact id', () => {
    expect(findLabelIdById(labels, 'l2')).toBe('l2')
  })

  it('returns undefined when the id is not present', () => {
    expect(findLabelIdById(labels, 'missing')).toBeUndefined()
  })
})
