import type { SampleImporter } from '../types'
import { cvLabelImporter } from './cvlabel'
import { plainImagesImporter } from './plainImages'
import { yoloImporter } from './yolo'
import { cocoImporter } from './coco'

export enum ImporterId {
  CvLabel = 'cv-label',
  PlainImages = 'plain-images',
  Yolo = 'yolo',
  Coco = 'coco'
}

export const importers: Record<ImporterId, SampleImporter> = {
  [ImporterId.CvLabel]: cvLabelImporter,
  [ImporterId.PlainImages]: plainImagesImporter,
  [ImporterId.Yolo]: yoloImporter,
  [ImporterId.Coco]: cocoImporter
}
