import { ILabel } from '@shared/types'

/** Turns a LabelMapper mapping (every project label -> itself, another label to merge
 *  into, or `null` to exclude) into what an exporter needs: the distinct set of labels
 *  that actually end up in the export, in a stable order, plus a routing table from
 *  every *source* label id to that target's index. A label mapped to `null` is simply
 *  absent from `labelIdToIndex`, so it's dropped by the same skip-if-missing logic the
 *  Coco/Yolo builders already use for an unmapped id. Two labels mapped to the same
 *  target route to the same index (merge). */
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
