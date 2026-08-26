import { ILabel } from '@shared/types'

const normalizeLabelName = (name: string): string => name.trim().toLowerCase()

/** Case/whitespace-insensitive name match - the only reliable signal for defaulting an imported class to a project label, since YOLO/COCO ids don't share id space with this app's. */
export const findLabelIdByName = (labels: ILabel[], name: string): string | undefined =>
  labels.find((label) => normalizeLabelName(label.name) === normalizeLabelName(name))?.id

/** Exact label id match - only meaningful when re-importing this app's own export format. */
export const findLabelIdById = (labels: ILabel[], id: string): string | undefined =>
  labels.find((label) => label.id === id)?.id
