import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AnnotationType, TrainingSplit } from '@shared/types'
import type { VirtualFile } from '../../virtualFileSystem'
import { cvLabelDatasetToSamples, findCvLabelManifest, findCvLabelPairs } from '../parseCvLabel'

const makeFile = (path: string, content: string): VirtualFile => ({
  path,
  text: () => Promise.resolve(content),
  blob: () => Promise.resolve(new Blob([content]))
})

const manifestJson = (labels: unknown[], samples: unknown[]) => JSON.stringify({ labels, samples })

describe('findCvLabelManifest', () => {
  it('reads labels and samples from manifest.json', async () => {
    const files = [
      makeFile(
        'manifest.json',
        manifestJson(
          [{ id: 'l1', name: 'Person' }],
          [{ id: 's1', name: 'photo', split: 'train', annotations: [], imageFile: 'images/s1.jpg' }]
        )
      )
    ]

    const found = await findCvLabelManifest(files)

    expect(found?.manifest.labels).toEqual([{ id: 'l1', name: 'Person' }])
    expect(found?.manifest.samples).toHaveLength(1)
    expect(found?.dir).toBe('')
  })

  it('resolves the manifest directory when the archive wraps content in a folder', async () => {
    const files = [makeFile('MyExport/manifest.json', manifestJson([], []))]

    const found = await findCvLabelManifest(files)

    expect(found?.dir).toBe('MyExport/')
  })

  it('returns null when there is no manifest.json', async () => {
    const files = [makeFile('img1.jpg', '')]

    expect(await findCvLabelManifest(files)).toBeNull()
  })

  it('returns null when manifest.json is not valid JSON', async () => {
    const files = [makeFile('manifest.json', 'not json')]

    expect(await findCvLabelManifest(files)).toBeNull()
  })

  it('returns null when manifest.json is missing the expected shape', async () => {
    const files = [makeFile('manifest.json', JSON.stringify({ hello: 'world' }))]

    expect(await findCvLabelManifest(files)).toBeNull()
  })
})

describe('findCvLabelPairs', () => {
  it('resolves each sample image relative to the manifest directory', () => {
    const manifest = {
      labels: [],
      samples: [
        { id: 's1', name: 'photo', split: 'train', annotations: [], imageFile: 'images/s1.jpg' }
      ]
    }
    const files = [makeFile('MyExport/images/s1.jpg', 'fake-image-bytes')]

    const [pair] = findCvLabelPairs(manifest as never, 'MyExport/', files)

    expect(pair.image?.path).toBe('MyExport/images/s1.jpg')
  })

  it('keeps a sample with a null image when its file is missing from the archive', () => {
    const manifest = {
      labels: [],
      samples: [
        { id: 's1', name: 'photo', split: 'train', annotations: [], imageFile: 'images/s1.jpg' }
      ]
    }

    const [pair] = findCvLabelPairs(manifest as never, '', [])

    expect(pair.image).toBeNull()
  })
})

describe('cvLabelDatasetToSamples', () => {
  const writeFile = vi.fn()

  beforeEach(() => {
    writeFile.mockReset().mockResolvedValue(undefined)
    window.system = { writeFile } as unknown as typeof window.system
  })

  it('remaps each annotation labelId via the given mapping, and regenerates every id', async () => {
    const pairs = [
      {
        sample: {
          id: 's1',
          name: 'photo',
          split: TrainingSplit.Train,
          annotations: [
            {
              id: 'orig-a1',
              type: AnnotationType.Box,
              labelId: 'source-l1',
              points: [{ id: 'orig-p1', x: 10, y: 20 }]
            }
          ],
          createdAt: '2026-01-01T00:00:00.000Z',
          imageFile: 'images/s1.jpg'
        },
        image: makeFile('images/s1.jpg', 'fake-image-bytes')
      }
    ]
    const labelIdToProjectLabelId = new Map([['source-l1', 'target-l1']])

    const samples = await cvLabelDatasetToSamples(pairs, labelIdToProjectLabelId, '/scratch')

    expect(samples).toHaveLength(1)
    expect(samples[0].imagePath).toMatch(/^\/scratch\/.+\.jpg$/)
    expect(samples[0].id).not.toBe('s1')
    expect(samples[0].name).toBe('photo')
    expect(samples[0].annotations).toHaveLength(1)
    expect(samples[0].annotations[0].id).not.toBe('orig-a1')
    expect(samples[0].annotations[0].labelId).toBe('target-l1')
    expect(samples[0].annotations[0].points[0].id).not.toBe('orig-p1')
    expect(samples[0].annotations[0].points[0]).toMatchObject({ x: 10, y: 20 })
  })

  it('skips annotations whose source label has no mapping', async () => {
    const pairs = [
      {
        sample: {
          id: 's1',
          name: 'photo',
          split: TrainingSplit.Train,
          annotations: [{ id: 'a1', type: AnnotationType.Box, labelId: 'unmapped', points: [] }],
          createdAt: '2026-01-01T00:00:00.000Z',
          imageFile: 'images/s1.jpg'
        },
        image: makeFile('images/s1.jpg', 'x')
      }
    ]

    const samples = await cvLabelDatasetToSamples(pairs, new Map(), '/scratch')

    expect(samples[0].annotations).toHaveLength(0)
  })

  it('skips samples with no resolved image', async () => {
    const pairs = [
      {
        sample: {
          id: 's1',
          name: 'photo',
          split: TrainingSplit.Train,
          annotations: [],
          createdAt: '2026-01-01T00:00:00.000Z',
          imageFile: 'images/s1.jpg'
        },
        image: null
      }
    ]

    expect(await cvLabelDatasetToSamples(pairs, new Map(), '/scratch')).toHaveLength(0)
  })

  it('reports progress per pair processed, including skipped ones', async () => {
    const pairs = [
      {
        sample: {
          id: 's1',
          name: 'a',
          split: TrainingSplit.Train,
          annotations: [],
          createdAt: '2026-01-01T00:00:00.000Z',
          imageFile: 'a.jpg'
        },
        image: makeFile('a.jpg', 'x')
      },
      {
        sample: {
          id: 's2',
          name: 'b',
          split: TrainingSplit.Train,
          annotations: [],
          createdAt: '2026-01-01T00:00:00.000Z',
          imageFile: 'b.jpg'
        },
        image: null
      }
    ]
    const onProgress = vi.fn()

    await cvLabelDatasetToSamples(pairs, new Map(), '/scratch', onProgress)

    expect(onProgress).toHaveBeenCalledTimes(2)
    expect(onProgress).toHaveBeenLastCalledWith(2, 2)
  })
})
