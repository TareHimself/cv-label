import { AnnotationType, IAnnotator, IPoint, IProposedAnnotation, ISample } from '@shared/types'
import { arrayBufferToBase64, makeUUID } from '@shared/utils'
import { normalizeAnnotationPoints } from '@renderer/hooks/useLabeler'
import { imageExtensionFromUri } from '@renderer/components/sampleIO/exporters/imageExtensionFromUri'
import type { AnnotatorAnnotation, AnnotatorLabel, AnnotatorPoint } from '@renderer/types'

const EXTENSION_MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp'
}

const withRoute = (baseUrl: string, route: string) => `${baseUrl.replace(/\/+$/, '')}${route}`

const isAnnotatorLabel = (value: unknown): value is AnnotatorLabel =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as AnnotatorLabel).id === 'string' &&
  typeof (value as AnnotatorLabel).name === 'string'

const isAnnotatorPoint = (value: unknown): value is AnnotatorPoint =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as AnnotatorPoint).x === 'number' &&
  typeof (value as AnnotatorPoint).y === 'number'

const isAnnotatorAnnotation = (value: unknown): value is AnnotatorAnnotation =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as AnnotatorAnnotation).labelId === 'string' &&
  typeof (value as AnnotatorAnnotation).type === 'string' &&
  Array.isArray((value as AnnotatorAnnotation).points) &&
  (value as AnnotatorAnnotation).points.every(isAnnotatorPoint) &&
  typeof (value as AnnotatorAnnotation).confidence === 'number' &&
  (value as AnnotatorAnnotation).confidence >= 0 &&
  (value as AnnotatorAnnotation).confidence <= 1

/** Calls an annotator server's `/connect` route for its label vocabulary - never persisted, so this must be called again any time the mapping UI reopens. */
export const connectToAnnotator = async (
  url: string,
  headers: Record<string, string>
): Promise<AnnotatorLabel[]> => {
  const response = await fetch(withRoute(url, '/connect'), {
    method: 'GET',
    headers
  })

  if (!response.ok) {
    throw new Error(`Annotator /connect failed: ${response.status} ${response.statusText}`)
  }

  const data: unknown = await response.json()
  const labels = (data as { labels?: unknown })?.labels

  if (!Array.isArray(labels)) {
    throw new Error('Annotator /connect response is missing a "labels" array')
  }

  return labels.filter(isAnnotatorLabel)
}

/** Resolves raw `/predict` output through labelMapping into IProposedAnnotations - an unmapped or malformed prediction (including a missing/out-of-range confidence) is dropped and counted, never guessed at. */
export const mapPredictionsToAnnotations = (
  predictions: unknown,
  labelMapping: Record<string, string | null>
): { annotations: IProposedAnnotation[]; skipped: number } => {
  const annotations: IProposedAnnotation[] = []
  let skipped = 0

  if (!Array.isArray(predictions)) {
    return { annotations, skipped }
  }

  for (const prediction of predictions) {
    if (!isAnnotatorAnnotation(prediction)) {
      skipped++
      continue
    }

    const labelId = labelMapping[prediction.labelId]
    const isValidType =
      prediction.type === AnnotationType.Box || prediction.type === AnnotationType.Polygon
    const hasEnoughPoints =
      prediction.type === AnnotationType.Box
        ? prediction.points.length === 2
        : prediction.points.length >= 3

    if (labelId === undefined || labelId === null || !isValidType || !hasEnoughPoints) {
      skipped++
      continue
    }

    const points: IPoint[] = prediction.points.map((point) => ({
      id: makeUUID(),
      x: point.x,
      y: point.y
    }))

    const annotation: IProposedAnnotation = {
      id: makeUUID(),
      type: prediction.type,
      labelId,
      points,
      confidence: prediction.confidence
    }

    annotations.push(normalizeAnnotationPoints(annotation))
  }

  return { annotations, skipped }
}

/** Runs one sample through an annotator: reads its image bytes, POSTs to /predict, resolves through labelMapping. Throws on any network/parse failure so the caller can attribute it to this sample. */
export const runAnnotatorOnSample = async (
  annotator: IAnnotator,
  labelMapping: Record<string, string | null>,
  sample: Pick<ISample, 'imageUri' | 'width' | 'height'>
): Promise<{ annotations: IProposedAnnotation[]; skipped: number }> => {
  // A renderer-side fetch() on image:// is blocked by Chromium's cross-origin scheme allowlist - read it via main instead.
  const imageResult = await window.storeManager.readImage(sample.imageUri)

  const mimeType =
    (imageResult.mimeType !== 'application/octet-stream' && imageResult.mimeType) ||
    EXTENSION_MIME_TYPES[imageExtensionFromUri(sample.imageUri).toLowerCase()] ||
    'application/octet-stream'

  const image = arrayBufferToBase64(imageResult.data)

  const predictResponse = await fetch(withRoute(annotator.url, '/predict'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...annotator.headers },
    body: JSON.stringify({ image, mimeType, width: sample.width, height: sample.height })
  })

  if (!predictResponse.ok) {
    throw new Error(
      `Annotator /predict failed: ${predictResponse.status} ${predictResponse.statusText}`
    )
  }

  const data: unknown = await predictResponse.json()
  return mapPredictionsToAnnotations((data as { annotations?: unknown })?.annotations, labelMapping)
}
