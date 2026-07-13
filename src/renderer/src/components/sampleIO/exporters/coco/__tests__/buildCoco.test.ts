import { describe, expect, it } from 'vitest'
import { AnnotationType, IAnnotation, ILabel } from '@shared/types'
import {
  buildCocoAnnotations,
  buildCocoCategories,
  cocoAnnotationsFilePath,
  cocoImagePath,
  CocoShapeMode
} from '../buildCoco'

const makeAnnotation = (
  type: AnnotationType,
  labelId: string,
  points: IAnnotation['points']
): IAnnotation => ({ id: 'a1', type, labelId, points })

describe('buildCocoCategories', () => {
  it('assigns 1-indexed category ids in label order', () => {
    const labels: ILabel[] = [
      { id: 'l1', name: 'person', color: '#fff' },
      { id: 'l2', name: 'car', color: '#000' }
    ]

    expect(buildCocoCategories(labels)).toEqual([
      { id: 1, name: 'person', supercategory: 'none' },
      { id: 2, name: 'car', supercategory: 'none' }
    ])
  })
})

describe('buildCocoAnnotations', () => {
  const nextId = () => {
    let id = 1
    return () => id++
  }
  const box = makeAnnotation(AnnotationType.Box, 'l1', [
    { id: 'p0', x: 10, y: 20 },
    { id: 'p1', x: 110, y: 70 }
  ])
  const mask = makeAnnotation(AnnotationType.Mask, 'l1', [
    { id: 'p0', x: 0, y: 0 },
    { id: 'p1', x: 20, y: 0 },
    { id: 'p2', x: 20, y: 10 },
    { id: 'p3', x: 0, y: 10 }
  ])

  describe('in Segment mode', () => {
    it('gives a Box annotation an axis-aligned bbox with a rectangular segmentation', () => {
      const result = buildCocoAnnotations(
        [box],
        1,
        new Map([['l1', 1]]),
        nextId(),
        CocoShapeMode.Segment
      )

      expect(result).toEqual([
        {
          id: 1,
          image_id: 1,
          category_id: 1,
          bbox: [10, 20, 100, 50],
          area: 5000,
          segmentation: [[10, 20, 110, 20, 110, 70, 10, 70]],
          iscrowd: 0
        }
      ])
    })

    it('keeps a Mask annotation as its own polygon, deriving bbox and area from it', () => {
      const [entry] = buildCocoAnnotations(
        [mask],
        1,
        new Map([['l1', 1]]),
        nextId(),
        CocoShapeMode.Segment
      )

      expect(entry.segmentation).toEqual([[0, 0, 20, 0, 20, 10, 0, 10]])
      expect(entry.bbox).toEqual([0, 0, 20, 10])
      expect(entry.area).toBe(200)
    })
  })

  describe('in Box mode', () => {
    it('gives a Box annotation a bbox with no segmentation', () => {
      const [entry] = buildCocoAnnotations(
        [box],
        1,
        new Map([['l1', 1]]),
        nextId(),
        CocoShapeMode.Box
      )

      expect(entry.bbox).toEqual([10, 20, 100, 50])
      expect(entry.segmentation).toEqual([])
    })

    it('flattens a Mask annotation to its bounding box, discarding the real outline', () => {
      const [entry] = buildCocoAnnotations(
        [mask],
        1,
        new Map([['l1', 1]]),
        nextId(),
        CocoShapeMode.Box
      )

      expect(entry.bbox).toEqual([0, 0, 20, 10])
      expect(entry.segmentation).toEqual([])
      expect(entry.area).toBe(200)
    })
  })

  describe('in Native mode', () => {
    it('leaves a Box annotation with no segmentation, since it never had one', () => {
      const [entry] = buildCocoAnnotations(
        [box],
        1,
        new Map([['l1', 1]]),
        nextId(),
        CocoShapeMode.Native
      )

      expect(entry.bbox).toEqual([10, 20, 100, 50])
      expect(entry.segmentation).toEqual([])
    })

    it('keeps a Mask annotation as its real outline', () => {
      const [entry] = buildCocoAnnotations(
        [mask],
        1,
        new Map([['l1', 1]]),
        nextId(),
        CocoShapeMode.Native
      )

      expect(entry.segmentation).toEqual([[0, 0, 20, 0, 20, 10, 0, 10]])
      expect(entry.bbox).toEqual([0, 0, 20, 10])
      expect(entry.area).toBe(200)
    })
  })

  it('normalizes Box corners regardless of point order', () => {
    const reversedBox = makeAnnotation(AnnotationType.Box, 'l1', [
      { id: 'p0', x: 110, y: 70 },
      { id: 'p1', x: 10, y: 20 }
    ])

    const [entry] = buildCocoAnnotations(
      [reversedBox],
      1,
      new Map([['l1', 1]]),
      nextId(),
      CocoShapeMode.Segment
    )

    expect(entry.bbox).toEqual([10, 20, 100, 50])
  })

  it('skips annotations whose label has no mapped category', () => {
    expect(buildCocoAnnotations([box], 1, new Map(), nextId(), CocoShapeMode.Segment)).toEqual([])
  })

  it('assigns ids via the given generator, in encounter order', () => {
    const secondBox = makeAnnotation(AnnotationType.Box, 'l1', [
      { id: 'p0', x: 20, y: 20 },
      { id: 'p1', x: 30, y: 30 }
    ])

    const result = buildCocoAnnotations(
      [box, secondBox],
      5,
      new Map([['l1', 1]]),
      nextId(),
      CocoShapeMode.Segment
    )

    expect(result.map((a) => a.id)).toEqual([1, 2])
    expect(result.every((a) => a.image_id === 5)).toBe(true)
  })
})

describe('cocoImagePath / cocoAnnotationsFilePath', () => {
  it('nests images and the annotations file under the split folder', () => {
    expect(cocoImagePath('s1', 'train', 'jpg')).toBe('train/s1.jpg')
    expect(cocoAnnotationsFilePath('train')).toBe('train/_annotations.coco.json')
  })
})
