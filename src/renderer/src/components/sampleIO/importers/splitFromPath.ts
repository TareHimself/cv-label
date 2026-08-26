import { TrainingSplit } from '@shared/types'

const VALID_PATH_PATTERN = /(^|\/)(val|valid|validation)(\/|$)/i
const TEST_PATH_PATTERN = /(^|\/)test(ing)?(\/|$)/i

/** Infers train/valid/test split from the dataset path (conventional YOLO/COCO folder layout) - defaults to Train when neither pattern matches. */
export const splitFromPath = (path: string): TrainingSplit => {
  if (VALID_PATH_PATTERN.test(path)) return TrainingSplit.Valid
  if (TEST_PATH_PATTERN.test(path)) return TrainingSplit.Test
  return TrainingSplit.Train
}
