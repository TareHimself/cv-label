import { describe, expect, it } from 'vitest'
import { ILabel } from '@shared/types'
import { buildIncludedLabelsAndIndex } from '../labelRouting'

const labels: ILabel[] = [
  { id: 'l1', name: 'Person', color: '#ff0000' },
  { id: 'l2', name: 'Car', color: '#00ff00' },
  { id: 'l3', name: 'Truck', color: '#0000ff' }
]

describe('buildIncludedLabelsAndIndex', () => {
  it('identity mapping keeps every label, each at its own index', () => {
    const mapping = new Map(labels.map((l) => [l.id, l.id]))
    const { includedLabels, labelIdToIndex } = buildIncludedLabelsAndIndex(labels, mapping)

    expect(includedLabels).toEqual(labels)
    expect(Object.fromEntries(labelIdToIndex)).toEqual({ l1: 0, l2: 1, l3: 2 })
  })

  it('a label mapped to null is excluded and dropped from routing', () => {
    const mapping = new Map([
      ['l1', 'l1'],
      ['l2', null],
      ['l3', 'l3']
    ])
    const { includedLabels, labelIdToIndex } = buildIncludedLabelsAndIndex(labels, mapping)

    expect(includedLabels.map((l) => l.id)).toEqual(['l1', 'l3'])
    expect(labelIdToIndex.has('l2')).toBe(false)
    expect(labelIdToIndex.get('l1')).toBe(0)
    expect(labelIdToIndex.get('l3')).toBe(1)
  })

  it('two labels mapped to the same target merge into one included label and index', () => {
    const mapping = new Map([
      ['l1', 'l2'],
      ['l2', 'l2'],
      ['l3', null]
    ])
    const { includedLabels, labelIdToIndex } = buildIncludedLabelsAndIndex(labels, mapping)

    expect(includedLabels.map((l) => l.id)).toEqual(['l2'])
    expect(labelIdToIndex.get('l1')).toBe(0)
    expect(labelIdToIndex.get('l2')).toBe(0)
    expect(labelIdToIndex.has('l3')).toBe(false)
  })

  it('a source label absent from the mapping is treated as excluded', () => {
    const mapping = new Map([['l1', 'l1']])
    const { includedLabels, labelIdToIndex } = buildIncludedLabelsAndIndex(labels, mapping)

    expect(includedLabels.map((l) => l.id)).toEqual(['l1'])
    expect(labelIdToIndex.has('l2')).toBe(false)
    expect(labelIdToIndex.has('l3')).toBe(false)
  })

  it('preserves the original labels order in includedLabels regardless of mapping insertion order', () => {
    const mapping = new Map([
      ['l3', 'l3'],
      ['l1', 'l1']
    ])
    const { includedLabels } = buildIncludedLabelsAndIndex(labels, mapping)

    expect(includedLabels.map((l) => l.id)).toEqual(['l1', 'l3'])
  })
})
