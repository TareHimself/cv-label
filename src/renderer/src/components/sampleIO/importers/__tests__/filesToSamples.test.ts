import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TrainingSplit } from '@shared/types'
import { filesToSamples } from '../filesToSamples'

const makeFile = (name: string, content = 'x') => new File([content], name, { type: 'image/jpeg' })

const writeFile = vi.fn()

beforeEach(() => {
  writeFile.mockReset().mockResolvedValue(undefined)
  window.system = { writeFile } as unknown as typeof window.system
})

describe('filesToSamples', () => {
  it('converts files into new samples referencing a scratch file per image', async () => {
    const samples = await filesToSamples(
      [makeFile('photo-one.jpg'), makeFile('photo-two.jpg')],
      '/scratch'
    )

    expect(samples).toHaveLength(2)
    expect(samples[0].name).toBe('photo-one')
    expect(samples[1].name).toBe('photo-two')
    for (const sample of samples) {
      expect(sample.id).toBeTruthy()
      expect(sample.imagePath).toMatch(/^\/scratch\/.+\.jpg$/)
      expect(sample.split).toBe(TrainingSplit.Train)
      expect(sample.annotations).toEqual([])
    }
    expect(writeFile).toHaveBeenCalledTimes(2)
  })

  it('reports progress as each file finishes writing', async () => {
    const onProgress = vi.fn()

    await filesToSamples(
      [makeFile('a.jpg'), makeFile('b.jpg'), makeFile('c.jpg')],
      '/scratch',
      onProgress
    )

    expect(onProgress).toHaveBeenCalledTimes(3)
    // Each call reports (completed, total) - total is always the full file count, and by
    // the end every file 1..N has been reported as completed exactly once.
    const completedValues = onProgress.mock.calls.map(([completed]) => completed).sort()
    expect(completedValues).toEqual([1, 2, 3])
    for (const [, total] of onProgress.mock.calls) {
      expect(total).toBe(3)
    }
  })

  it('returns an empty array for an empty file list', async () => {
    await expect(filesToSamples([], '/scratch')).resolves.toEqual([])
  })
})
