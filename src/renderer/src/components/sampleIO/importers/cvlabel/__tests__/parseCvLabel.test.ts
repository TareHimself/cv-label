import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AnnotationType, TrainingSplit } from '@shared/types'
import type { VirtualFile } from '../../virtualFileSystem'
import {
  cvLabelDatasetToSamples,
  cvLabelManifestTasksToGroups,
  cvLabelManifestToNewProject,
  findCvLabelManifest,
  findCvLabelPairs,
  type CvLabelManifest
} from '../parseCvLabel'

const makeFile = (path: string, content: string): VirtualFile => ({
  path,
  text: () => Promise.resolve(content),
  blob: () => Promise.resolve(new Blob([content]))
})

const manifestJson = (labels: unknown[], tasks: unknown[]) =>
  JSON.stringify({ version: 1, labels, tasks })

describe('findCvLabelManifest', () => {
  it('reads labels and tasks, samples nested under each task', async () => {
    const files = [
      makeFile(
        'manifest.json',
        manifestJson(
          [{ id: 'l1', name: 'Person' }],
          [
            {
              id: 't1',
              name: 'Batch 1',
              samples: [
                {
                  id: 's1',
                  name: 'photo',
                  split: 'train',
                  annotations: [],
                  imageFile: 'images/s1.jpg'
                }
              ]
            }
          ]
        )
      )
    ]

    const found = await findCvLabelManifest(files)

    expect(found?.manifest.labels).toEqual([{ id: 'l1', name: 'Person' }])
    expect(found?.manifest.tasks[0].samples).toHaveLength(1)
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

  it('returns null for a manifest with no version (pre-release format, unsupported)', async () => {
    const files = [makeFile('manifest.json', JSON.stringify({ labels: [], tasks: [] }))]

    expect(await findCvLabelManifest(files)).toBeNull()
  })
})

describe('findCvLabelPairs', () => {
  it('resolves each sample image relative to the manifest directory', () => {
    const samples = [
      { id: 's1', name: 'photo', split: 'train', annotations: [], imageFile: 'images/s1.jpg' }
    ]
    const files = [makeFile('MyExport/images/s1.jpg', 'fake-image-bytes')]

    const [pair] = findCvLabelPairs(samples as never, 'MyExport/', files)

    expect(pair.image?.path).toBe('MyExport/images/s1.jpg')
  })

  it('keeps a sample with a null image when its file is missing from the archive', () => {
    const samples = [
      { id: 's1', name: 'photo', split: 'train', annotations: [], imageFile: 'images/s1.jpg' }
    ]

    const [pair] = findCvLabelPairs(samples as never, '', [])

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

const twoTaskManifest: CvLabelManifest = {
  version: 1,
  labels: [{ id: 'src-l1', name: 'Person' }],
  tasks: [
    {
      id: 'src-t1',
      name: 'Batch 1',
      samples: [
        {
          id: 'src-s1',
          name: 'photo-1',
          split: TrainingSplit.Train,
          annotations: [
            {
              id: 'src-a1',
              type: AnnotationType.Box,
              labelId: 'src-l1',
              points: [{ id: 'p1', x: 0, y: 0 }]
            }
          ],
          createdAt: '2026-01-01T00:00:00.000Z',
          imageFile: 'images/s1.jpg'
        }
      ]
    },
    {
      id: 'src-t2',
      name: 'Batch 2',
      samples: [
        {
          id: 'src-s2',
          name: 'photo-2',
          split: TrainingSplit.Train,
          annotations: [],
          createdAt: '2026-01-01T00:00:00.000Z',
          imageFile: 'images/s2.jpg'
        }
      ]
    }
  ]
}
const twoTaskFiles = [
  makeFile('images/s1.jpg', 'fake-image-bytes'),
  makeFile('images/s2.jpg', 'fake-image-bytes')
]

describe('cvLabelManifestTasksToGroups', () => {
  const writeFile = vi.fn()

  beforeEach(() => {
    writeFile.mockReset().mockResolvedValue(undefined)
    window.system = { writeFile } as unknown as typeof window.system
  })

  it('converts each task separately, applying the same label mapping to every one', async () => {
    const mapping = new Map([['src-l1', 'target-l1']])

    const groups = await cvLabelManifestTasksToGroups(
      twoTaskManifest,
      '',
      twoTaskFiles,
      mapping,
      '/scratch'
    )

    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({ name: 'Batch 1' })
    expect(groups[0].samples).toHaveLength(1)
    expect(groups[0].samples[0].annotations[0].labelId).toBe('target-l1')
    expect(groups[1]).toMatchObject({ name: 'Batch 2' })
    expect(groups[1].samples).toHaveLength(1)
  })

  it('reports progress across every task combined', async () => {
    const onProgress = vi.fn()

    await cvLabelManifestTasksToGroups(
      twoTaskManifest,
      '',
      twoTaskFiles,
      new Map([['src-l1', 'target-l1']]),
      '/scratch',
      onProgress
    )

    expect(onProgress).toHaveBeenLastCalledWith(2, 2)
  })
})

describe('cvLabelManifestToNewProject', () => {
  const writeFile = vi.fn()

  beforeEach(() => {
    writeFile.mockReset().mockResolvedValue(undefined)
    window.system = { writeFile } as unknown as typeof window.system
  })

  const manifest = twoTaskManifest
  const files = twoTaskFiles

  it('regenerates label ids with fresh colors, keeping annotations pointed at the new ids', async () => {
    const { labels, tasks } = await cvLabelManifestToNewProject(manifest, '', files, '/scratch')

    expect(labels).toHaveLength(1)
    expect(labels[0].id).not.toBe('src-l1')
    expect(labels[0].name).toBe('Person')
    expect(labels[0].color).toMatch(/^#[0-9a-f]{6}$/i)
    expect(tasks[0].samples[0].annotations[0].labelId).toBe(labels[0].id)
  })

  it('preserves task structure, regenerating task and sample ids', async () => {
    const { tasks } = await cvLabelManifestToNewProject(manifest, '', files, '/scratch')

    expect(tasks).toHaveLength(2)
    expect(tasks[0].id).not.toBe('src-t1')
    expect(tasks[0].name).toBe('Batch 1')
    expect(tasks[0].samples[0].id).not.toBe('src-s1')
    expect(tasks[0].samples[0].name).toBe('photo-1')
  })

  it('skips samples with no resolved image', async () => {
    const { tasks } = await cvLabelManifestToNewProject(manifest, '', [], '/scratch')

    expect(tasks[0].samples).toHaveLength(0)
  })

  it('reports progress across every task combined', async () => {
    const onProgress = vi.fn()

    await cvLabelManifestToNewProject(manifest, '', files, '/scratch', onProgress)

    expect(onProgress).toHaveBeenLastCalledWith(2, 2)
  })
})
