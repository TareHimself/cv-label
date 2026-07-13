import { describe, expect, it, vi } from 'vitest'
import { AnnotationType, TrainingSplit } from '@shared/types'
import type { VirtualFile } from '../../virtualFileSystem'
import {
  cocoAnnotationToPoints,
  cocoDatasetToSamples,
  findCocoClasses,
  findCocoImagePairs
} from '../parseCoco'

const makeFile = (path: string, content: string): VirtualFile => ({
  path,
  text: () => Promise.resolve(content),
  blob: () => Promise.resolve(new Blob([content]))
})

const cocoJson = (images: unknown[], annotations: unknown[], categories: unknown[]) =>
  JSON.stringify({ images, annotations, categories })

describe('findCocoImagePairs', () => {
  it('resolves file_name relative to the annotations file directory and pairs annotations by image_id', async () => {
    const files = [
      makeFile('train/img1.jpg', ''),
      makeFile(
        'train/_annotations.coco.json',
        cocoJson(
          [{ id: 1, file_name: 'img1.jpg', width: 100, height: 100 }],
          [{ image_id: 1, category_id: 1, bbox: [10, 10, 20, 20] }],
          [{ id: 1, name: 'person' }]
        )
      )
    ]

    const pairs = await findCocoImagePairs(files)

    expect(pairs).toHaveLength(1)
    expect(pairs[0].image.path).toBe('train/img1.jpg')
    expect(pairs[0].annotations).toHaveLength(1)
  })

  it('infers the split from the annotations directory, defaulting to Train', async () => {
    const files = [
      makeFile('train/img1.jpg', ''),
      makeFile(
        'train/_annotations.coco.json',
        cocoJson([{ id: 1, file_name: 'img1.jpg' }], [], [])
      ),
      makeFile('valid/img2.jpg', ''),
      makeFile(
        'valid/_annotations.coco.json',
        cocoJson([{ id: 1, file_name: 'img2.jpg' }], [], [])
      ),
      makeFile('test/img3.jpg', ''),
      makeFile('test/_annotations.coco.json', cocoJson([{ id: 1, file_name: 'img3.jpg' }], [], []))
    ]

    const pairs = await findCocoImagePairs(files)

    expect(pairs.find((p) => p.image.path.includes('img1'))?.split).toBe(TrainingSplit.Train)
    expect(pairs.find((p) => p.image.path.includes('img2'))?.split).toBe(TrainingSplit.Valid)
    expect(pairs.find((p) => p.image.path.includes('img3'))?.split).toBe(TrainingSplit.Test)
  })

  it('skips images referenced by the json but missing from the file list', async () => {
    const files = [
      makeFile(
        'train/_annotations.coco.json',
        cocoJson([{ id: 1, file_name: 'missing.jpg' }], [], [])
      )
    ]

    expect(await findCocoImagePairs(files)).toHaveLength(0)
  })

  it('ignores .json files that are not valid JSON or not COCO-shaped', async () => {
    const files = [
      makeFile('train/img1.jpg', ''),
      makeFile('train/_annotations.coco.json', 'not json'),
      makeFile('readme.json', JSON.stringify({ hello: 'world' }))
    ]

    expect(await findCocoImagePairs(files)).toHaveLength(0)
  })
})

describe('findCocoClasses', () => {
  it('dedupes categories across multiple annotation files, keeping encounter order', async () => {
    const files = [
      makeFile(
        'train/_annotations.coco.json',
        cocoJson(
          [],
          [],
          [
            { id: 1, name: 'person' },
            { id: 2, name: 'car' }
          ]
        )
      ),
      makeFile(
        'valid/_annotations.coco.json',
        cocoJson(
          [],
          [],
          [
            { id: 2, name: 'car' },
            { id: 3, name: 'truck' }
          ]
        )
      )
    ]

    expect(await findCocoClasses(files)).toEqual([
      { id: 1, name: 'person' },
      { id: 2, name: 'car' },
      { id: 3, name: 'truck' }
    ])
  })
})

describe('cocoAnnotationToPoints', () => {
  it('converts a bbox with no segmentation into a Box', () => {
    expect(
      cocoAnnotationToPoints({ image_id: 1, category_id: 1, bbox: [10, 20, 100, 50] })
    ).toEqual({
      type: AnnotationType.Box,
      points: [
        { id: expect.any(String), x: 10, y: 20 },
        { id: expect.any(String), x: 110, y: 70 }
      ]
    })
  })

  it("treats a segmentation that is just the bbox rectangle as a Box (round-tripping this app's own COCO export)", () => {
    const result = cocoAnnotationToPoints({
      image_id: 1,
      category_id: 1,
      bbox: [10, 20, 100, 50],
      segmentation: [[10, 20, 110, 20, 110, 70, 10, 70]]
    })

    expect(result.type).toBe(AnnotationType.Box)
    expect(result.points).toEqual([
      { id: expect.any(String), x: 10, y: 20 },
      { id: expect.any(String), x: 110, y: 70 }
    ])
  })

  it('treats a real (non-rectangular) polygon segmentation as a Mask', () => {
    const result = cocoAnnotationToPoints({
      image_id: 1,
      category_id: 1,
      bbox: [0, 0, 10, 10],
      segmentation: [[0, 0, 10, 0, 5, 10]]
    })

    expect(result.type).toBe(AnnotationType.Mask)
    expect(result.points).toEqual([
      { id: expect.any(String), x: 0, y: 0 },
      { id: expect.any(String), x: 10, y: 0 },
      { id: expect.any(String), x: 5, y: 10 }
    ])
  })
})

describe('cocoDatasetToSamples', () => {
  it('builds a sample per image, mapping COCO categories to the given project label ids', async () => {
    const files = [
      makeFile('img1.jpg', 'fake-image-bytes'),
      makeFile(
        '_annotations.coco.json',
        cocoJson(
          [{ id: 1, file_name: 'img1.jpg' }],
          [{ image_id: 1, category_id: 5, bbox: [0, 0, 10, 10] }],
          [{ id: 5, name: 'person' }]
        )
      )
    ]
    const pairs = await findCocoImagePairs(files)
    const categoryIdToLabelId = new Map([[5, 'label-a']])

    const samples = await cocoDatasetToSamples(pairs, categoryIdToLabelId)

    expect(samples).toHaveLength(1)
    expect(samples[0].name).toBe('img1')
    expect(samples[0].annotations).toHaveLength(1)
    expect(samples[0].annotations[0].labelId).toBe('label-a')
  })

  it('skips annotations whose category has no mapped label', async () => {
    const files = [
      makeFile('img1.jpg', 'fake-image-bytes'),
      makeFile(
        '_annotations.coco.json',
        cocoJson(
          [{ id: 1, file_name: 'img1.jpg' }],
          [{ image_id: 1, category_id: 5, bbox: [0, 0, 10, 10] }],
          [{ id: 5, name: 'person' }]
        )
      )
    ]
    const pairs = await findCocoImagePairs(files)

    const samples = await cocoDatasetToSamples(pairs, new Map())

    expect(samples[0].annotations).toHaveLength(0)
  })

  it('reports progress as each image completes', async () => {
    const files = [
      makeFile('img1.jpg', ''),
      makeFile('img2.jpg', ''),
      makeFile(
        '_annotations.coco.json',
        cocoJson(
          [
            { id: 1, file_name: 'img1.jpg' },
            { id: 2, file_name: 'img2.jpg' }
          ],
          [],
          []
        )
      )
    ]
    const pairs = await findCocoImagePairs(files)
    const onProgress = vi.fn()

    await cocoDatasetToSamples(pairs, new Map(), onProgress)

    expect(onProgress).toHaveBeenCalledTimes(2)
    expect(onProgress).toHaveBeenLastCalledWith(2, 2)
  })
})
