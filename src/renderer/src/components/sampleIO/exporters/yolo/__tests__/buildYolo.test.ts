import { describe, expect, it } from 'vitest'
import { AnnotationType, IAnnotation, ILabel } from '@shared/types'
import {
  buildYoloDataYaml,
  ExportShape,
  yoloImagePath,
  yoloLabelFileContent,
  yoloLabelPath
} from '../buildYolo'

const makeAnnotation = (
  type: AnnotationType,
  labelId: string,
  points: IAnnotation['points']
): IAnnotation => ({ id: 'a1', type, labelId, points })

describe('buildYoloDataYaml', () => {
  it('lists split folders and a 0-indexed classId -> name map', () => {
    const labels: ILabel[] = [
      { id: 'l1', name: 'person', color: '#fff' },
      { id: 'l2', name: 'car', color: '#000' }
    ]

    expect(buildYoloDataYaml(labels)).toBe(
      'train: images/train\nval: images/valid\ntest: images/test\nnames:\n  0: person\n  1: car\n'
    )
  })
})

describe('yoloLabelFileContent in Box mode', () => {
  it('converts a Box annotation to a normalized class cx cy w h line', () => {
    const annotations = [
      makeAnnotation(AnnotationType.Box, 'l1', [
        { id: 'p0', x: 100, y: 50 },
        { id: 'p1', x: 300, y: 150 }
      ])
    ]
    const labelIdToClassId = new Map([['l1', 0]])

    expect(yoloLabelFileContent(annotations, labelIdToClassId, 400, 200, ExportShape.Box)).toBe(
      '0 0.500000 0.500000 0.500000 0.500000\n'
    )
  })

  it('normalizes points regardless of corner order', () => {
    const annotations = [
      makeAnnotation(AnnotationType.Box, 'l1', [
        { id: 'p0', x: 300, y: 150 },
        { id: 'p1', x: 100, y: 50 }
      ])
    ]
    const labelIdToClassId = new Map([['l1', 0]])

    expect(yoloLabelFileContent(annotations, labelIdToClassId, 400, 200, ExportShape.Box)).toBe(
      '0 0.500000 0.500000 0.500000 0.500000\n'
    )
  })

  it('flattens a Mask annotation to its own bounding box, rather than skipping it', () => {
    const annotations = [
      makeAnnotation(AnnotationType.Mask, 'l1', [
        { id: 'p0', x: 0, y: 0 },
        { id: 'p1', x: 10, y: 0 },
        { id: 'p2', x: 10, y: 10 }
      ])
    ]

    expect(yoloLabelFileContent(annotations, new Map([['l1', 0]]), 400, 200, ExportShape.Box)).toBe(
      '0 0.012500 0.025000 0.025000 0.050000\n'
    )
  })
})

describe('yoloLabelFileContent in Segment mode', () => {
  it('converts a Box annotation to its own 4 corners as a polygon line', () => {
    const annotations = [
      makeAnnotation(AnnotationType.Box, 'l1', [
        { id: 'p0', x: 100, y: 50 },
        { id: 'p1', x: 300, y: 150 }
      ])
    ]

    expect(
      yoloLabelFileContent(annotations, new Map([['l1', 0]]), 400, 200, ExportShape.Segment)
    ).toBe('0 0.250000 0.250000 0.750000 0.250000 0.750000 0.750000 0.250000 0.750000\n')
  })

  it('keeps a Mask annotation as its real polygon', () => {
    const annotations = [
      makeAnnotation(AnnotationType.Mask, 'l1', [
        { id: 'p0', x: 0, y: 0 },
        { id: 'p1', x: 10, y: 0 },
        { id: 'p2', x: 10, y: 10 }
      ])
    ]

    expect(
      yoloLabelFileContent(annotations, new Map([['l1', 0]]), 400, 200, ExportShape.Segment)
    ).toBe('0 0.000000 0.000000 0.025000 0.000000 0.025000 0.050000\n')
  })
})

describe('yoloLabelFileContent shared behavior', () => {
  it('skips annotations whose label has no mapped classId', () => {
    const annotations = [
      makeAnnotation(AnnotationType.Box, 'unmapped', [
        { id: 'p0', x: 0, y: 0 },
        { id: 'p1', x: 10, y: 10 }
      ])
    ]

    expect(yoloLabelFileContent(annotations, new Map(), 400, 200, ExportShape.Box)).toBe('')
  })

  it('returns an empty string when there are no annotations', () => {
    expect(yoloLabelFileContent([], new Map(), 400, 200, ExportShape.Box)).toBe('')
  })
})

describe('yoloImagePath / yoloLabelPath', () => {
  it('nests by split under images/ and labels/', () => {
    expect(yoloImagePath('s1', 'train', 'jpg')).toBe('images/train/s1.jpg')
    expect(yoloLabelPath('s1', 'train')).toBe('labels/train/s1.txt')
  })
})
