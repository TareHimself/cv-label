import { describe, expect, it, vi, beforeEach } from 'vitest'
import { AnnotationType, TrainingSplit } from '@shared/types'
import type { VirtualFile } from '../../virtualFileSystem'
import {
  findReferencedClassIds,
  findYoloClasses,
  findYoloImagePairs,
  parseYoloLabelFile,
  parseYoloSegmentationLabelFile,
  yoloBoxToPoints,
  yoloDatasetToSamples,
  yoloPolygonToPoints,
  YoloLabelFormat
} from '../parseYolo'

const makeFile = (path: string, content: string): VirtualFile => ({
  path,
  text: () => Promise.resolve(content),
  blob: () => Promise.resolve(new Blob([content]))
})

describe('findYoloClasses', () => {
  it('reads a list-style names field from data.yaml', async () => {
    const files = [makeFile('data.yaml', 'names:\n  - person\n  - car\n')]

    expect(await findYoloClasses(files)).toEqual([
      { id: 0, name: 'person' },
      { id: 1, name: 'car' }
    ])
  })

  it('reads a dict-style names field from data.yaml, sorted by id', async () => {
    const files = [makeFile('dataset.yml', 'names:\n  1: car\n  0: person\n')]

    expect(await findYoloClasses(files)).toEqual([
      { id: 0, name: 'person' },
      { id: 1, name: 'car' }
    ])
  })

  it('falls back to classes.txt when there is no data.yaml', async () => {
    const files = [makeFile('classes.txt', 'person\ncar\n\n')]

    expect(await findYoloClasses(files)).toEqual([
      { id: 0, name: 'person' },
      { id: 1, name: 'car' }
    ])
  })

  it('prefers data.yaml over classes.txt when both are present', async () => {
    const files = [makeFile('classes.txt', 'dog\n'), makeFile('data.yaml', 'names:\n  - cat\n')]

    expect(await findYoloClasses(files)).toEqual([{ id: 0, name: 'cat' }])
  })

  it('returns null when neither is present', async () => {
    const files = [makeFile('images/img1.jpg', '')]

    expect(await findYoloClasses(files)).toBeNull()
  })
})

describe('parseYoloLabelFile', () => {
  it('parses bounding-box lines', () => {
    expect(parseYoloLabelFile('0 0.5 0.5 0.2 0.4\n1 0.1 0.1 0.05 0.05')).toEqual([
      { classId: 0, cx: 0.5, cy: 0.5, w: 0.2, h: 0.4 },
      { classId: 1, cx: 0.1, cy: 0.1, w: 0.05, h: 0.05 }
    ])
  })

  it('skips blank lines', () => {
    expect(parseYoloLabelFile('0 0.5 0.5 0.2 0.4\n\n\n')).toHaveLength(1)
  })

  it('skips malformed lines instead of throwing', () => {
    expect(parseYoloLabelFile('not a valid line\n0 0.5 0.5 0.2 0.4')).toEqual([
      { classId: 0, cx: 0.5, cy: 0.5, w: 0.2, h: 0.4 }
    ])
  })

  it('ignores trailing columns beyond the first five', () => {
    expect(parseYoloLabelFile('0 0.5 0.5 0.2 0.4 0.1 0.2 0.3 0.4')).toEqual([
      { classId: 0, cx: 0.5, cy: 0.5, w: 0.2, h: 0.4 }
    ])
  })
})

describe('parseYoloSegmentationLabelFile', () => {
  it('parses polygon lines', () => {
    expect(parseYoloSegmentationLabelFile('0 0.1 0.1 0.2 0.1 0.2 0.2 0.1 0.2')).toEqual([
      {
        classId: 0,
        points: [
          { x: 0.1, y: 0.1 },
          { x: 0.2, y: 0.1 },
          { x: 0.2, y: 0.2 },
          { x: 0.1, y: 0.2 }
        ]
      }
    ])
  })

  it('skips blank lines', () => {
    expect(parseYoloSegmentationLabelFile('0 0.1 0.1 0.2 0.1 0.2 0.2\n\n\n')).toHaveLength(1)
  })

  it('skips lines with fewer than 3 vertices', () => {
    expect(parseYoloSegmentationLabelFile('0 0.1 0.1 0.2 0.1')).toEqual([])
  })

  it('skips malformed lines instead of throwing', () => {
    expect(parseYoloSegmentationLabelFile('not a valid line')).toEqual([])
  })
})

describe('yoloBoxToPoints', () => {
  it('converts a normalized center/size box to absolute top-left/bottom-right pixels', () => {
    const [topLeft, bottomRight] = yoloBoxToPoints(
      { classId: 0, cx: 0.5, cy: 0.5, w: 0.5, h: 0.25 },
      200,
      100
    )

    expect(topLeft.x).toBeCloseTo(50)
    expect(topLeft.y).toBeCloseTo(37.5)
    expect(bottomRight.x).toBeCloseTo(150)
    expect(bottomRight.y).toBeCloseTo(62.5)
  })
})

describe('yoloPolygonToPoints', () => {
  it('converts normalized polygon vertices to absolute pixels', () => {
    const points = yoloPolygonToPoints(
      {
        classId: 0,
        points: [
          { x: 0.1, y: 0.2 },
          { x: 0.5, y: 0.5 }
        ]
      },
      200,
      100
    )

    expect(points[0].x).toBeCloseTo(20)
    expect(points[0].y).toBeCloseTo(20)
    expect(points[1].x).toBeCloseTo(100)
    expect(points[1].y).toBeCloseTo(50)
  })
})

describe('findYoloImagePairs', () => {
  it('matches a label file in the same directory', () => {
    const files = [makeFile('img1.jpg', ''), makeFile('img1.txt', '0 0.5 0.5 0.1 0.1')]

    const [pair] = findYoloImagePairs(files)

    expect(pair.image.path).toBe('img1.jpg')
    expect(pair.label?.path).toBe('img1.txt')
  })

  it('matches a label file via the images/ -> labels/ sibling convention', () => {
    const files = [
      makeFile('dataset/images/train/img1.jpg', ''),
      makeFile('dataset/labels/train/img1.txt', '0 0.5 0.5 0.1 0.1')
    ]

    const [pair] = findYoloImagePairs(files)

    expect(pair.label?.path).toBe('dataset/labels/train/img1.txt')
  })

  it('keeps images with no matching label file, with a null label', () => {
    const files = [makeFile('img1.jpg', '')]

    const [pair] = findYoloImagePairs(files)

    expect(pair.label).toBeNull()
  })

  it('ignores non-image files', () => {
    const files = [makeFile('img1.jpg', ''), makeFile('readme.md', '')]

    expect(findYoloImagePairs(files)).toHaveLength(1)
  })

  it('defaults images under a val/valid folder to Valid, a test folder to Test, everything else to Train', () => {
    const files = [
      makeFile('dataset/images/train/img1.jpg', ''),
      makeFile('dataset/images/val/img2.jpg', ''),
      makeFile('dataset/images/valid/img3.jpg', ''),
      makeFile('dataset/images/test/img4.jpg', '')
    ]

    const pairs = findYoloImagePairs(files)

    expect(pairs.find((p) => p.image.path.includes('img1'))?.split).toBe(TrainingSplit.Train)
    expect(pairs.find((p) => p.image.path.includes('img2'))?.split).toBe(TrainingSplit.Valid)
    expect(pairs.find((p) => p.image.path.includes('img3'))?.split).toBe(TrainingSplit.Valid)
    expect(pairs.find((p) => p.image.path.includes('img4'))?.split).toBe(TrainingSplit.Test)
  })
})

describe('findReferencedClassIds', () => {
  it('returns the distinct class ids used across all label files, sorted', async () => {
    const files = [
      makeFile('img1.jpg', ''),
      makeFile('img1.txt', '2 0.5 0.5 0.1 0.1\n0 0.5 0.5 0.1 0.1'),
      makeFile('img2.jpg', ''),
      makeFile('img2.txt', '0 0.5 0.5 0.1 0.1\n1 0.5 0.5 0.1 0.1')
    ]

    expect(await findReferencedClassIds(findYoloImagePairs(files))).toEqual([0, 1, 2])
  })
})

describe('yoloDatasetToSamples', () => {
  const writeFile = vi.fn()

  beforeEach(() => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({ width: 400, height: 200, close: vi.fn() })
    )
    writeFile.mockReset().mockResolvedValue(undefined)
    window.system = { writeFile } as unknown as typeof window.system
  })

  it('builds a sample per image, mapping YOLO classes to the given project label ids', async () => {
    const files = [
      makeFile('img1.jpg', 'fake-image-bytes'),
      makeFile('img1.txt', '0 0.5 0.5 0.5 0.5')
    ]
    const pairs = findYoloImagePairs(files)
    const classIdToLabelId = new Map([[0, 'label-a']])

    const samples = await yoloDatasetToSamples(
      pairs,
      classIdToLabelId,
      YoloLabelFormat.Detection,
      '/scratch'
    )

    expect(samples).toHaveLength(1)
    expect(samples[0].name).toBe('img1')
    expect(samples[0].imagePath).toMatch(/^\/scratch\/.+\.jpg$/)
    expect(samples[0].annotations).toHaveLength(1)
    expect(samples[0].annotations[0].type).toBe(AnnotationType.Box)
    expect(samples[0].annotations[0].labelId).toBe('label-a')
    expect(samples[0].annotations[0].points).toHaveLength(2)
  })

  it('in Segmentation format, builds Mask annotations from polygon lines', async () => {
    const files = [
      makeFile('img1.jpg', 'fake-image-bytes'),
      makeFile('img1.txt', '0 0.1 0.1 0.2 0.1 0.2 0.2')
    ]
    const pairs = findYoloImagePairs(files)
    const classIdToLabelId = new Map([[0, 'label-a']])

    const samples = await yoloDatasetToSamples(
      pairs,
      classIdToLabelId,
      YoloLabelFormat.Segmentation,
      '/scratch'
    )

    expect(samples[0].annotations).toHaveLength(1)
    expect(samples[0].annotations[0].type).toBe(AnnotationType.Mask)
    expect(samples[0].annotations[0].points).toHaveLength(3)
  })

  it('skips boxes whose class has no mapping entry', async () => {
    const files = [
      makeFile('img1.jpg', 'fake-image-bytes'),
      makeFile('img1.txt', '5 0.5 0.5 0.5 0.5')
    ]
    const pairs = findYoloImagePairs(files)

    const samples = await yoloDatasetToSamples(
      pairs,
      new Map(),
      YoloLabelFormat.Detection,
      '/scratch'
    )

    expect(samples[0].annotations).toHaveLength(0)
  })

  it('imports images with no label file as samples with no annotations', async () => {
    const files = [makeFile('img1.jpg', 'fake-image-bytes')]
    const pairs = findYoloImagePairs(files)

    const samples = await yoloDatasetToSamples(
      pairs,
      new Map(),
      YoloLabelFormat.Detection,
      '/scratch'
    )

    expect(samples).toHaveLength(1)
    expect(samples[0].annotations).toEqual([])
  })

  it('reports progress as each image completes', async () => {
    const files = [makeFile('img1.jpg', ''), makeFile('img2.jpg', ''), makeFile('img3.jpg', '')]
    const pairs = findYoloImagePairs(files)
    const onProgress = vi.fn()

    await yoloDatasetToSamples(pairs, new Map(), YoloLabelFormat.Detection, '/scratch', onProgress)

    expect(onProgress).toHaveBeenCalledTimes(3)
    expect(onProgress).toHaveBeenLastCalledWith(3, 3)
  })
})
