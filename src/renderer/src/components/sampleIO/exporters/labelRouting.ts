import { ILabel } from '@shared/types'

/** Turns a LabelMapper mapping into what an exporter needs: the distinct labels that end up in the export, in stable order, plus a source-label-id -> target-index routing table. A `null` target is simply absent from labelIdToIndex, dropped by the same skip-if-missing logic the Coco/Yolo builders use. Two labels mapped to the same target route to the same index (merge). */
export const buildIncludedLabelsAndIndex = (
  labels: ILabel[],
  mapping: Map<string, string | null>
): { includedLabels: ILabel[]; labelIdToIndex: Map<string, number> } => {
  const targetIds = new Set<string>()
  for (const target of mapping.values()) {
    if (target !== null) targetIds.add(target)
  }

  const includedLabels = labels.filter((label) => targetIds.has(label.id))
  const targetIdToIndex = new Map(includedLabels.map((label, index) => [label.id, index]))

  const labelIdToIndex = new Map<string, number>()
  for (const label of labels) {
    const target = mapping.get(label.id)
    if (target === null || target === undefined) continue
    const index = targetIdToIndex.get(target)
    if (index !== undefined) labelIdToIndex.set(label.id, index)
  }

  return { includedLabels, labelIdToIndex }
}
