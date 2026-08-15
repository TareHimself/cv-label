import { describe, expect, it, vi, beforeEach } from 'vitest'
import { AnnotationType, IAnnotator, ISample, TrainingSplit } from '@shared/types'
import {
  connectToAnnotator,
  mapPredictionsToAnnotations,
  runAnnotatorOnSample
} from '../ExternalAnnotator'

const jsonResponse = (body: unknown, init: { ok?: boolean; status?: number } = {}) => ({
  ok: init.ok ?? true,
  status: init.status ?? 200,
  statusText: 'status',
  headers: new Headers(),
  json: () => Promise.resolve(body),
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(0))
})

describe('connectToAnnotator', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('gets <url>/connect and returns the reported labels', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ labels: [{ id: '0', name: 'cat' }] }))
    vi.stubGlobal('fetch', fetchMock)

    const labels = await connectToAnnotator('https://example.com/model/', { 'X-Api-Key': 'k' })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/model/connect',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ 'X-Api-Key': 'k' })
      })
    )
    expect(labels).toEqual([{ id: '0', name: 'cat' }])
  })

  it('drops malformed label entries', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ labels: [{ id: '0', name: 'cat' }, { id: 1, name: 'bad-id' }, 'nope'] })
        )
    )

    const labels = await connectToAnnotator('https://example.com', {})
    expect(labels).toEqual([{ id: '0', name: 'cat' }])
  })

  it('throws when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, { ok: false, status: 500 })))
    await expect(connectToAnnotator('https://example.com', {})).rejects.toThrow(/connect failed/)
  })

  it('throws when the response has no labels array', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ oops: true })))
    await expect(connectToAnnotator('https://example.com', {})).rejects.toThrow(/labels/)
  })
})

describe('mapPredictionsToAnnotations', () => {
  const labelMapping = { '0': 'project-label-1', '1': null }

  it('resolves a mapped box prediction into a normalized annotation', () => {
    const { annotations, skipped } = mapPredictionsToAnnotations(
      [
        {
          labelId: '0',
          type: AnnotationType.Box,
          points: [
            { x: 80, y: 90 },
            { x: 10, y: 20 }
          ]
        }
      ],
      labelMapping
    )

    expect(skipped).toBe(0)
    expect(annotations).toHaveLength(1)
    const [annotation] = annotations
    expect(annotation.labelId).toBe('project-label-1')
    expect(annotation.type).toBe(AnnotationType.Box)
    // normalizeAnnotationPoints reorders box corners to [min, max]
    expect(annotation.points[0]).toMatchObject({ x: 10, y: 20 })
    expect(annotation.points[1]).toMatchObject({ x: 80, y: 90 })
    expect(annotation.points[0].id).toEqual(expect.any(String))
  })

  it('skips a prediction whose labelId has no mapping entry', () => {
    const { annotations, skipped } = mapPredictionsToAnnotations(
      [
        {
          labelId: 'unknown',
          type: AnnotationType.Box,
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 1 }
          ]
        }
      ],
      labelMapping
    )
    expect(annotations).toHaveLength(0)
    expect(skipped).toBe(1)
  })

  it('skips a prediction explicitly mapped to null (ignored)', () => {
    const { annotations, skipped } = mapPredictionsToAnnotations(
      [
        {
          labelId: '1',
          type: AnnotationType.Box,
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 1 }
          ]
        }
      ],
      labelMapping
    )
    expect(annotations).toHaveLength(0)
    expect(skipped).toBe(1)
  })

  it('skips a box with the wrong number of points', () => {
    const { annotations, skipped } = mapPredictionsToAnnotations(
      [{ labelId: '0', type: AnnotationType.Box, points: [{ x: 0, y: 0 }] }],
      labelMapping
    )
    expect(annotations).toHaveLength(0)
    expect(skipped).toBe(1)
  })

  it('accepts a polygon with 3+ points', () => {
    const { annotations, skipped } = mapPredictionsToAnnotations(
      [
        {
          labelId: '0',
          type: AnnotationType.Polygon,
          points: [
            { x: 0, y: 0 },
            { x: 5, y: 0 },
            { x: 5, y: 5 }
          ]
        }
      ],
      labelMapping
    )
    expect(skipped).toBe(0)
    expect(annotations).toHaveLength(1)
    expect(annotations[0].points).toHaveLength(3)
  })

  it('skips malformed prediction shapes and non-array input', () => {
    expect(mapPredictionsToAnnotations('nope', labelMapping)).toEqual({
      annotations: [],
      skipped: 0
    })
    expect(mapPredictionsToAnnotations([{ labelId: '0' }], labelMapping)).toEqual({
      annotations: [],
      skipped: 1
    })
  })
})

describe('runAnnotatorOnSample', () => {
  const annotator: IAnnotator = {
    id: 'a1',
    name: 'Test annotator',
    url: 'https://example.com',
    headers: { Authorization: 'Bearer token' }
  }
  const labelMapping = { '0': 'project-label-1' }

  const sample: ISample = {
    id: 's1',
    name: 'sample.png',
    split: TrainingSplit.Train,
    annotations: [],
    createdAt: new Date().toISOString(),
    completedAt: null,
    imageUri: 'image://local/s1.png',
    width: 100,
    height: 100
  }

  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetches the sample image, posts base64 bytes to /predict, and maps the result', async () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer
    const imageHeaders = new Headers({ 'content-type': 'image/png' })
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: imageHeaders,
        arrayBuffer: () => Promise.resolve(bytes)
      })
      .mockResolvedValueOnce(
        jsonResponse({
          annotations: [
            {
              labelId: '0',
              type: AnnotationType.Box,
              points: [
                { x: 0, y: 0 },
                { x: 1, y: 1 }
              ]
            }
          ]
        })
      )
    vi.stubGlobal('fetch', fetchMock)

    const result = await runAnnotatorOnSample(annotator, labelMapping, sample)

    expect(fetchMock).toHaveBeenNthCalledWith(1, sample.imageUri)
    const [predictUrl, predictInit] = fetchMock.mock.calls[1]
    expect(predictUrl).toBe('https://example.com/predict')
    expect(predictInit.headers).toEqual(expect.objectContaining({ Authorization: 'Bearer token' }))
    const body = JSON.parse(predictInit.body)
    expect(body).toMatchObject({ mimeType: 'image/png', width: 100, height: 100 })
    expect(typeof body.image).toBe('string')

    expect(result.skipped).toBe(0)
    expect(result.annotations).toHaveLength(1)
    expect(result.annotations[0].labelId).toBe('project-label-1')
  })

  it('throws if the sample image cannot be fetched', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' })
    )
    await expect(runAnnotatorOnSample(annotator, labelMapping, sample)).rejects.toThrow(
      /sample image/
    )
  })

  it('throws if /predict responds with a non-ok status', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'image/png' }),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0))
      })
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Server Error' })
    vi.stubGlobal('fetch', fetchMock)

    await expect(runAnnotatorOnSample(annotator, labelMapping, sample)).rejects.toThrow(
      /predict failed/
    )
  })
})
