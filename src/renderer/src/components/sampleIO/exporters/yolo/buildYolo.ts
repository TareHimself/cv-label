import { stringify } from 'yaml'
import { IAnnotation, ILabel } from '@shared/types'
import { exportShapePoints, ExportShape } from '../annotationShape'
import { boundingBoxOf } from '@renderer/util/boundingBox'

export { ExportShape }

/** Ultralytics-style data.yaml: split folders plus a 0-indexed classId -> name map, ordered the same way findYoloClasses reads it back on re-import. */
export const buildYoloDataYaml = (labels: ILabel[]): string =>
  stringify({
    train: 'images/train',
    val: 'images/valid',
    test: 'images/test',
    // A Map keeps classId as a YAML int key instead of a quoted string - Ultralytics indexes `names` by integer.
    names: new Map(labels.map((label, id) => [id, label.name]))
  })

/** One label line per annotation, normalized to [0,1]. Box mode always writes `class cx cy w h`; Segment mode writes `class x1 y1 ... xn yn` (a Box's own 4 corners, or a Polygon's real outline). */
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
