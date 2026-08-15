import { stringify } from 'yaml'
import { IAnnotation, ILabel } from '@shared/types'
import { boundingBoxOf, exportShapePoints, ExportShape } from '../annotationShape'

export { ExportShape }

/** Ultralytics-style data.yaml: split folders plus a 0-indexed classId -> name map,
 *  ordered the same way findYoloClasses would read it back on re-import. */
export const buildYoloDataYaml = (labels: ILabel[]): string =>
  stringify({
    train: 'images/train',
    val: 'images/valid',
    test: 'images/test',
    // A Map (rather than a plain object) keeps classId as a YAML int key instead of a
    // quoted string, since Ultralytics indexes `names` by integer.
    names: new Map(labels.map((label, id) => [id, label.name]))
  })

/** One label line per annotation, normalized to [0,1]. In Box mode every annotation
 *  (Polygon included) becomes a `class cx cy w h` bounding box; in Segment mode it
 *  becomes a `class x1 y1 x2 y2 ... xn yn` polygon - a Box's own 4 corners, or a
 *  Polygon's real outline. Either way nothing is skipped, unlike the plain detection
 *  format's usual box-only restriction. */
export const yoloLabelFileContent = (
  annotations: IAnnotation[],
  labelIdToClassId: Map<string, number>,
  imageWidth: number,
  imageHeight: number,
  shape: ExportShape
): string => {
  const lines: string[] = []

  for (const annotation of annotations) {
    if (annotation.points.length < 2) continue
    const classId = labelIdToClassId.get(annotation.labelId)
    if (classId === undefined) continue

    if (shape === ExportShape.Box) {
      const box = boundingBoxOf(annotation.points)
      const cx = (box.minX + box.width / 2) / imageWidth
      const cy = (box.minY + box.height / 2) / imageHeight
      const w = box.width / imageWidth
      const h = box.height / imageHeight
      lines.push(`${classId} ${cx.toFixed(6)} ${cy.toFixed(6)} ${w.toFixed(6)} ${h.toFixed(6)}`)
    } else {
      const coords = exportShapePoints(annotation, shape)
        .flatMap((p) => [p.x / imageWidth, p.y / imageHeight])
        .map((v) => v.toFixed(6))
        .join(' ')
      lines.push(`${classId} ${coords}`)
    }
  }

  return lines.length > 0 ? `${lines.join('\n')}\n` : ''
}

export const yoloImagePath = (sampleId: string, split: string, extension: string): string =>
  `images/${split}/${sampleId}.${extension}`

export const yoloLabelPath = (sampleId: string, split: string): string =>
  `labels/${split}/${sampleId}.txt`
