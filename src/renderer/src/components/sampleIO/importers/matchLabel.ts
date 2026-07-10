import { ILabel } from '@shared/types'

const normalizeLabelName = (name: string): string => name.trim().toLowerCase()

/** Matches by a case/whitespace-insensitive name comparison - used to default an
 *  imported class/category to a project label of the same name, since importers have
 *  no other reliable signal (YOLO classes and COCO categories don't share id space with
 *  this app's own label ids). */
export const findLabelIdByName = (labels: ILabel[], name: string): string | undefined =>
  labels.find((label) => normalizeLabelName(label.name) === normalizeLabelName(name))?.id

/** Matches by exact label id - only meaningful when re-importing this app's own export
 *  format, where the source label ids are this app's own label ids. */
export const findLabelIdById = (labels: ILabel[], id: string): string | undefined =>
  labels.find((label) => label.id === id)?.id
